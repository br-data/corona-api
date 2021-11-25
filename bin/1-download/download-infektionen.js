"use strict"

const fs = require('fs');
const config = require('../config.js');
const { fetch, download, csv2array, saveNDJSON } = require('../../lib/helper.js');
const { resolve } = require('path');


const apiUrl = 'https://api.github.com/repos/robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland/contents/';
const rawFilename = resolve(config.folders.raw, 'infektionen.tsv')
const cleanedFilename = resolve(config.folders.cleaned, 'infektionen.ndjson');

module.exports = {
	update,
}

async function update(state) {
	console.log('   überprüfe infektionen');

	if (!state) state = {};
	if (!state.times) state.times = {};
	state.changed = false;


	
	let isNewData = await checkData();

	if (isNewData || !fs.existsSync(rawFilename)) {
		await downloadData();
	}

	if (isNewData || !fs.existsSync(cleanedFilename)) {
		await cleanData();

		console.log('   fertig mit infektionen')
		state.changed = true;
		return state;
	}
	
	console.log('   überspringe infektionen')
	return state;

	async function checkData() {
		state.times.checkStart = new Date();

		let directory = await fetch(apiUrl, { 'User-Agent': 'curl/7.64.1' })
		directory = JSON.parse(directory);
		let file = directory.find(e => e.name === 'Aktuell_Deutschland_SarsCov2_Infektionen.csv')

		if (!file) throw Error('Could not find "https://github.com/robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland/blob/master/Aktuell_Deutschland_SarsCov2_Infektionen.csv"')

		let isNewData = (state.hash !== file.sha)
		
		state.hash = file.sha;
		state.source = 'https://media.githubusercontent.com/media/robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland/master/Aktuell_Deutschland_SarsCov2_Infektionen.csv';

		state.times.checkEnd = new Date();

		return isNewData
	}

	async function downloadData() {
		state.times.downloadStart = new Date();

		console.log('      runterladen');
		await download(state.source, rawFilename, {gzip:true});
		console.log('      wurde runtergeladen');

		state.times.downloadEnd = new Date();
	}

	async function cleanData() {
		state.times.cleanStart = new Date();

		console.log('      daten säubern');

		let data = fs.readFileSync(rawFilename, 'utf8');
		data = csv2array(data, ',', '\r\n');

		data = data.map(e => ({
			landkreisId: parseInt(e.IdLandkreis, 10),
			altersgruppe: cleanAltersgruppe(e.Altersgruppe),
			geschlecht: e.Geschlecht.toLowerCase(),
			meldedatum: e.Meldedatum,
			refdatum: e.Refdatum,
			istErkrankungsbeginn: parseInt(e.IstErkrankungsbeginn, 10),
			neuerFall: parseInt(e.NeuerFall),
			neuerTodesfall: parseInt(e.NeuerTodesfall),
			neuGenesen: parseInt(e.NeuGenesen),
			anzahlFall: parseInt(e.AnzahlFall),
			anzahlTodesfall: parseInt(e.AnzahlTodesfall),
			anzahlGenesen: parseInt(e.AnzahlGenesen),
		}))

		saveNDJSON(cleanedFilename, data);

		state.times.cleanEnd = new Date();

		function cleanAltersgruppe(text) {
			switch (text) {
				case 'unbekannt': return 'unbekannt';
				case 'A00-A04':   return '0-4';
				case 'A05-A14':   return '5-14';
				case 'A15-A34':   return '15-34';
				case 'A35-A59':   return '35-59';
				case 'A60-A79':   return '60-79';
				case 'A80+':      return '80+';
			}
			throw Error('unbekannte Altersgruppe "'+text+'"')
		}
	}
}