"use strict"

const fs = require('fs');
const config = require('../config.js');
const { fetch, download, csv2array, saveJSON, checkUniqueKeys, summarizer } = require('../../lib/helper.js');
const { resolve } = require('path');


const githubRepo = 'robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland';
const githubFile = 'Aktuell_Deutschland_SarsCov2_Infektionen.csv';


module.exports = function Downloader() {
	const cleanedFilenames = {
		infektionLK:    resolve(config.folders.cleaned, 'infektion-lk.json'),
		infektionBL:    resolve(config.folders.cleaned, 'infektion-bl.json'),
		infektionDE:    resolve(config.folders.cleaned, 'infektion-de.json'),
		infektionDEAlt: resolve(config.folders.cleaned, 'infektion-de-alt.json'),
		infektionBLAlt: resolve(config.folders.cleaned, 'infektion-bl-alt.json'),
	}

	return {
		checkUpdates,
		downloadData,
		cleanData,
		cleanedFilenames,
	}

	async function checkUpdates(state) {
		let directory = await fetch(`https://api.github.com/repos/${githubRepo}/contents/`, { 'User-Agent': 'curl/7.64.1' })
		directory = JSON.parse(directory);
		let file = directory.find(e => e.name === githubFile)

		if (!file) throw Error(`Could not find "https://github.com/${githubRepo}/blob/master/${githubFile}"`)

		let isNewData = (state.hash !== file.sha)
		
		state.hash = file.sha;
		state.sources = {
			infektion: {
				url:`https://media.githubusercontent.com/media/${githubRepo}/master/${githubFile}`,
				filename:resolve(config.folders.raw, 'infektion.tsv')
			}
		}

		return isNewData;
	}

	async function downloadData(state) {
		for (let source of Object.values(state.sources)) {
			await download(source.url, source.filename);
		}
	}

	async function cleanData(state) {
		let data = fs.readFileSync(state.sources.infektion.filename);

		// BOM
		if (data[0] === 0xEF) data = data.slice(3);
		data = data.toString('utf8');

		data = csv2array(data, ',', '\r\n');

		let dataLK    = summarizer(['meldedatum','landkreisId'                ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBL    = summarizer(['meldedatum','bundeslandId'               ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDE    = summarizer(['meldedatum'                              ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBLAlt = summarizer(['meldedatum','bundeslandId','altersgruppe'], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDEAlt = summarizer(['meldedatum',               'altersgruppe'], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);

		data.forEach(e => {
			let entry = {
				bundeslandId: parseInt(e.IdLandkreis.slice(0,-3), 10),
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
			}

			// ignoriere wegfallene Einträge;
			if (entry.neuerFall      === -1) return;
			if (entry.neuerTodesfall === -1) return;
			if (entry.neuGenesen     === -1) return;

			if ((entry.landkreisId >= 11001) && (entry.landkreisId <= 11012)) entry.landkreisId = 11000;

			dataLK.add(entry);
			dataBL.add(entry);
			dataDE.add(entry);
			dataBLAlt.add(entry);
			dataDEAlt.add(entry);
		})

		dataLK    = dataLK.get();
		dataBL    = dataBL.get();
		dataDE    = dataDE.get();
		dataBLAlt = dataBLAlt.get();
		dataDEAlt = dataDEAlt.get();

		saveJSON(cleanedFilenames.infektionLK,    dataLK);
		saveJSON(cleanedFilenames.infektionBL,    dataBL);
		saveJSON(cleanedFilenames.infektionDE,    dataDE);
		saveJSON(cleanedFilenames.infektionDEAlt, dataDEAlt);
		saveJSON(cleanedFilenames.infektionBLAlt, dataBLAlt);

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
