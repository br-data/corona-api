"use strict"

const fs = require('fs');
const config = require('../config.js');
const { fetch, download, csv2array } = require('../../lib/helper.js');
const { resolve } = require('path');


const apiUrl = 'https://api.github.com/repos/robert-koch-institut/COVID-19-Hospitalisierungen_in_Deutschland/contents/';
const rawFilename = resolve(config.folders.raw, `hospitalisierung.tsv`)
const cleanedFilename = resolve(config.folders.cleaned, 'hospitalisierung.json');

module.exports = {
	update,
}

async function update(state) {
	console.log('   überprüfe hospitalisierung');

	let newState = await checkData();
	let isNewData = (state.hash !== newState.hash)

	if (isNewData || !fs.existsSync(rawFilename)) {
		await downloadData(newState.source);
		newState.timeDownloaded = new Date();
	}

	if (isNewData || !fs.existsSync(cleanedFilename)) {
		await cleanData();
		newState.timeCleaned = new Date();

		console.log('   fertig mit hospitalisierung')
		return newState;
	}
	
	console.log('   überspringe hospitalisierung')
	return false;


	async function checkData() {
		let directory = await fetch(apiUrl, { 'User-Agent': 'curl/7.64.1' })
		directory = JSON.parse(directory);
		let file = directory.find(e => e.name === 'Aktuell_Deutschland_COVID-19-Hospitalisierungen.csv')

		if (!file) throw Error('Could not find "https://github.com/robert-koch-institut/COVID-19-Hospitalisierungen_in_Deutschland/blob/master/Aktuell_Deutschland_COVID-19-Hospitalisierungen.csv"')

		return {
			hash: file.sha,
			source: file.download_url,
			timeChecked: new Date(),
		}
	}

	async function downloadData(url) {

		console.log('      runterladen');
		await download(url, rawFilename);
		console.log('      wurde runtergeladen');

		return true;
	}

	async function cleanData() {
		console.log('      daten säubern');

		let data = fs.readFileSync(rawFilename, 'utf8');
		data = csv2array(data);

		data = data.map(e => ({
			datum: e.Datum,
			bundesland: e.Bundesland,
			bundeslandId: parseInt(e.Bundesland_Id,10),
			altersgruppe: cleanAltersgruppe(e.Altersgruppe),
			hospitalisierung7TFaelle: parseInt(e['7T_Hospitalisierung_Faelle'],10),
			hospitalisierung7TInzidenz: parseFloat(e['7T_Hospitalisierung_Inzidenz']),
		}))

		fs.writeFileSync(cleanedFilename, JSON.stringify(data));

		function cleanAltersgruppe(text) {
			switch (text) {
				case '00+': return 'alle';
				case '00-04': return '0-4';
				case '05-14': return '5-14';
				case '15-34':
				case '35-59':
				case '60-79':
				case '80+':
					return text;
			}
			throw Error('unbekannte Altersgruppe "'+text+'"')
		}
	}
}