"use strict"

const { fetch, getGithubFileMeta, csv2array, checkUniqueKeys, addMetadata } = require('../lib/helper.js');

module.exports = class Downloader extends require('./prototype.js') {

	githubRepo = 'robert-koch-institut/COVID-19-Hospitalisierungen_in_Deutschland';
	githubFile = 'Aktuell_Deutschland_COVID-19-Hospitalisierungen.csv';

	constructor() {
		super('hospitalisierung');
	}

	async checkUpdates() {
		let file = await getGithubFileMeta(this.githubRepo, this.githubFile);

		this.status.changed = (this.status.hash !== file.sha);
		this.status.newHash = file.sha;

		this.status.sources = {
			hospitalisierung: {
				url:file.download_url
			}
		}
	}

	async doUpdate() {
		let data = await fetch(this.status.sources.hospitalisierung.url);
		data = csv2array(data.toString('utf8'));

		let dataBL    = [];
		let dataDE    = [];
		let dataDEAlt = [];

		data.forEach(e => {
			let entry = {
				datum: e.Datum,
				bundeslandId: parseInt(e.Bundesland_Id,10),
				altersgruppe: cleanAltersgruppe(e.Altersgruppe),
				hospitalisierung7TFaelle: parseInt(e['7T_Hospitalisierung_Faelle'],10),
				hospitalisierung7TInzidenz: parseFloat(e['7T_Hospitalisierung_Inzidenz']),
			}
			if ((entry.bundeslandId  >  0) && (entry.altersgruppe === 'alle')) dataBL   .push(entry);
			if ((entry.bundeslandId === 0) && (entry.altersgruppe === 'alle')) dataDE   .push(entry);
			if ((entry.bundeslandId === 0) && (entry.altersgruppe !== 'alle')) dataDEAlt.push(entry);
		})

		if (!checkUniqueKeys(dataBL,   ['datum','bundeslandId'])) throw Error();
		if (!checkUniqueKeys(dataDE,   ['datum'])) throw Error();
		if (!checkUniqueKeys(dataDEAlt,['datum','altersgruppe'])) throw Error();
		
		addMetadata(dataBL,    ['deutschland','bundesland']);
		addMetadata(dataDE,    ['deutschland']);
		addMetadata(dataDEAlt, ['deutschland']);

		this.saveTable('bl',     dataBL);
		this.saveTable('de',     dataDE);
		this.saveTable('de-alt', dataDEAlt);

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
