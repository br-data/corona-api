"use strict"

const config = require('../lib/config.js');
const { fetch, getGithubFileMeta, csv2array, summarizer, cached } = require('../lib/helper.js');

module.exports = class Downloader extends require('./prototype.js') {

	githubRepo = 'robert-koch-institut/COVID-19-Impfungen_in_Deutschland';
	githubFile = 'Aktuell_Deutschland_Bundeslaender_COVID-19-Impfungen.csv';

	constructor() {
		super('impfungen');
	}

	async checkUpdates() {
		let file = await getGithubFileMeta(this.githubRepo, this.githubFile);

		// Die Versionsnummer wird den Datei-Hashes angefügt.
		// Wenn man sie erhöht, erzwingt man einen Datenupdate.
		let hash = file.sha+'_'+config.version;
		
		this.status.changed = (this.status.hash !== hash);
		this.status.newHash = hash;

		this.status.sources = {
			impfungen: {
				url:file.download_url
			}
		}
	}

	async doUpdate(opt = {}) {
		let loadData = () => fetch(this.status.sources.impfungen.url);
		let data = await (opt.cached ? cached('impfungen', loadData) : loadData());
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

		dataBLFull  = dataBLFull.get({fillGaps:true});
		dataDEFull  = dataDEFull.get({fillGaps:true});
		dataBLSerie = dataBLSerie.get({fillGaps:true});
		dataDESerie = dataDESerie.get({fillGaps:true});
		
		this.addMetadata(dataBLFull,  ['bundeslaender-einwohner' ]);
		this.addMetadata(dataDEFull,  ['deutschland-einwohner']);
		this.addMetadata(dataBLSerie, ['bundeslaender-einwohner' ]);
		this.addMetadata(dataDESerie, ['deutschland-einwohner']);

		this.saveTable('bl-full',  dataBLFull);
		this.saveTable('de-full',  dataDEFull);
		this.saveTable('bl-serie', dataBLSerie);
		this.saveTable('de-serie', dataDESerie);
	}
}
