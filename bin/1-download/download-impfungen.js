"use strict"

const fs = require('fs');
const config = require('../config.js');
const { fetch, download, csv2array, saveJSON, checkUniqueKeys, summarizer } = require('../../lib/helper.js');
const { resolve } = require('path');


const githubRepo = 'robert-koch-institut/COVID-19-Impfungen_in_Deutschland';
const githubFile = 'Aktuell_Deutschland_Bundeslaender_COVID-19-Impfungen.csv';


module.exports = function Downloader() {
	const cleanedFilenames = {
		impfungBL: resolve(config.folders.cleaned, 'impfung-bl.json'),
		impfungDE: resolve(config.folders.cleaned, 'impfung-de.json'),
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
			impfung: {
				url:file.download_url,
				filename:resolve(config.folders.raw, 'impfung.tsv')
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
		let data = fs.readFileSync(state.sources.impfung.filename, 'utf8');
		data = csv2array(data);

		let dataBL = [];
		let dataDE = summarizer(['datum','impfstoff','impfserie'],['anzahl']);

		data.forEach(e => {
			let entry = {
				datum: e.Impfdatum,
				bundeslandId: parseInt(e.BundeslandId_Impfort, 10),
				impfstoff: e.Impfstoff,
				impfserie: parseInt(e.Impfserie, 10),
				anzahl: parseInt(e.Anzahl, 10),
			}
			dataDE.add(entry);
			dataBL.push(entry);
		})

		dataDE = dataDE.get();
		
		if (!checkUniqueKeys(dataBL, ['datum','bundeslandId','impfstoff','impfserie'])) throw Error();
		if (!checkUniqueKeys(dataDE, ['datum',               'impfstoff','impfserie'])) throw Error();

		saveJSON(cleanedFilenames.impfungBL,  dataBL);
		saveJSON(cleanedFilenames.impfungDE,  dataDE);
	}
}
