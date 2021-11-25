"use strict"

const fs = require('fs');
const config = require('../config.js');
const { fetch, download, csv2array, saveNDJSON } = require('../../lib/helper.js');
const { resolve } = require('path');


const apiUrl = 'https://api.github.com/repos/robert-koch-institut/COVID-19-Impfungen_in_Deutschland/contents';

module.exports = {
	update,
}

async function update(state) {
	console.log('   überprüfe impfungen');

	if (!state) state = {};
	if (!state.times) state.times = {};
	state.changed = false;



	const rawFilename = resolve(config.folders.raw, 'impfungen.tsv');
	const cleanedFilename = resolve(config.folders.cleaned, 'impfungen.ndjson');

	let isNewData = await checkData();

	if (isNewData || !fs.existsSync(rawFilename)) {
		await downloadData();
	}

	if (isNewData || !fs.existsSync(cleanedFilename)) {
		await cleanData();

		console.log('   fertig mit impfungen')
		state.changed = true;
		return state;
	}
	
	console.log('   überspringe impfungen')
	return state;
	


	async function checkData() {
		state.times.checkStart = new Date();

		let directory = await fetch(apiUrl, { 'User-Agent': 'curl/7.64.1' })
		directory = JSON.parse(directory);
		let file = directory.find(e => e.name === 'Aktuell_Deutschland_Bundeslaender_COVID-19-Impfungen.csv')

		if (!file) throw Error('Could not find "https://github.com/robert-koch-institut/COVID-19-impfungenen_in_Deutschland/blob/master/Aktuell_Deutschland_Bundeslaender_COVID-19-Impfungen.csv')

		let isNewData = (state.hash !== file.sha)
		
		state.hash = file.sha;
		state.source = file.download_url;

		state.times.checkEnd = new Date();

		return isNewData
	}

	async function downloadData(url) {
		state.times.downloadStart = new Date();

		console.log('      runterladen');
		await download(state.source, rawFilename);
		console.log('      wurde runtergeladen');

		state.times.downloadEnd = new Date();
	}

	async function cleanData() {
		state.times.cleanStart = new Date();

		console.log('      daten säubern');

		let data = fs.readFileSync(rawFilename, 'utf8');
		data = csv2array(data);

		data = data.map(e => ({
			datum: e.Impfdatum,
			bundeslandId: parseInt(e.BundeslandId_Impfort, 10),
			impfstoff: e.Impfstoff,
			impfserie: parseInt(e.Impfserie, 10),
			anzahl: parseInt(e.Anzahl, 10),
		}))

		saveNDJSON(cleanedFilename, data);

		state.times.cleanEnd = new Date();
	}
}