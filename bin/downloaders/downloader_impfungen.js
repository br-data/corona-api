"use strict"

const { fetch, getGithubFileMeta, csv2array, checkUniqueKeys, summarizer, addMetadata } = require('../../lib/helper.js');

module.exports = class Downloader extends require('./prototype.js') {

	githubRepo = 'robert-koch-institut/COVID-19-Impfungen_in_Deutschland';
	githubFile = 'Aktuell_Deutschland_Bundeslaender_COVID-19-Impfungen.csv';

	constructor() {
		super('impfungen');
	}

	async checkUpdates() {
		let file = await getGithubFileMeta(this.githubRepo, this.githubFile);

		this.status.changed = (this.status.hash !== file.sha);
		this.status.newHash = file.sha;

		this.status.sources = {
			impfungen: {
				url:file.download_url
			}
		}
	}

	async doUpdate() {
		let data = await fetch(this.status.sources.impfungen.url);
		data = csv2array(data.toString('utf8'));

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
		
		addMetadata(dataBL, ['deutschland','bundesland']);
		addMetadata(dataDE, ['deutschland']);

		this.saveTable('bl', dataBL);
		this.saveTable('de', dataDE);
	}
}
