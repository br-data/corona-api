"use strict"

const fs = require('fs');
const config = require('../config.js');
const { fetch, download, csv2array, saveJSON, checkUniqueKeys } = require('../../lib/helper.js');
const { resolve } = require('path');


const githubRepo = 'robert-koch-institut/COVID-19-Hospitalisierungen_in_Deutschland';
const githubFile = 'Aktuell_Deutschland_COVID-19-Hospitalisierungen.csv';


module.exports = function Downloader() {
	const cleanedFilenames = {
		hospitalisierungBL:  resolve(config.folders.cleaned, 'hospitalisierung-bl.json'),
		hospitalisierungDE:  resolve(config.folders.cleaned, 'hospitalisierung-de.json'),
		hospitalisierungAlt: resolve(config.folders.cleaned, 'hospitalisierung-alt.json'),
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
			hospitalisierung: {
				url:file.download_url,
				filename:resolve(config.folders.raw, 'hospitalisierung.tsv')
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
		let data = fs.readFileSync(state.sources.hospitalisierung.filename, 'utf8');
		data = csv2array(data);

		let dataBL = [];
		let dataDE = [];
		let dataALT = [];

		data.forEach(e => {
			let entry = {
				datum: e.Datum,
				bundesland: e.Bundesland,
				bundeslandId: parseInt(e.Bundesland_Id,10),
				altersgruppe: cleanAltersgruppe(e.Altersgruppe),
				hospitalisierung7TFaelle: parseInt(e['7T_Hospitalisierung_Faelle'],10),
				hospitalisierung7TInzidenz: parseFloat(e['7T_Hospitalisierung_Inzidenz']),
			}
			if ((entry.bundeslandId === 0) && (entry.altersgruppe === 'alle')) dataDE .push(entry);
			if ((entry.bundeslandId  >  0) && (entry.altersgruppe === 'alle')) dataBL .push(entry);
			if ((entry.bundeslandId === 0) && (entry.altersgruppe !== 'alle')) dataALT.push(entry);
		})

		if (!checkUniqueKeys(dataBL, ['datum','bundeslandId'])) throw Error();
		if (!checkUniqueKeys(dataDE, ['datum'])) throw Error();
		if (!checkUniqueKeys(dataALT,['datum','altersgruppe'])) throw Error();

		saveJSON(cleanedFilenames.hospitalisierungBL,  dataBL);
		saveJSON(cleanedFilenames.hospitalisierungDE,  dataDE);
		saveJSON(cleanedFilenames.hospitalisierungAlt, dataALT);

		function cleanAltersgruppe(text) {
			switch (text) {
				case '00+':   return 'alle';
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
