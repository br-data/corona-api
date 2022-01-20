"use strict"

const { fetch, getGithubFileMeta, csv2array, checkUniqueKeys, summarizer, addMetadata } = require('../lib/helper.js');

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

		let dataBLFull  = summarizer(['datum','bundeslandId','impfstoff','impfserie'],['anzahl']);
		let dataDEFull  = summarizer(['datum',               'impfstoff','impfserie'],['anzahl']);
		let dataBLSerie = summarizer(['datum','bundeslandId',            'impfserie'],['anzahl']);
		let dataDESerie = summarizer(['datum',                           'impfserie'],['anzahl']);

		data.forEach(e => {
			let entry = {
				datum: e.Impfdatum,
				bundeslandId: parseInt(e.BundeslandId_Impfort, 10),
				impfstoff: e.Impfstoff,
				impfserie: parseInt(e.Impfserie, 10),
				anzahl: parseInt(e.Anzahl, 10),
			}
			dataDEFull.add(entry);
			dataBLFull.add(entry);
			dataDESerie.add(entry);
			dataBLSerie.add(entry);
		})

		dataBLFull  = dataBLFull.get();
		dataDEFull  = dataDEFull.get();
		dataBLSerie = dataBLSerie.get();
		dataDESerie = dataDESerie.get();
		
		addMetadata(dataBLFull,  ['deutschland','bundesland']);
		addMetadata(dataDEFull,  ['deutschland']);
		addMetadata(dataBLSerie, ['deutschland','bundesland']);
		addMetadata(dataDESerie, ['deutschland']);

		this.saveTable('bl-full',  dataBLFull);
		this.saveTable('de-full',  dataDEFull);
		this.saveTable('bl-serie', dataBLSerie);
		this.saveTable('de-serie', dataDESerie);
	}
}
