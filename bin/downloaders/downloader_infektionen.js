"use strict"

const { fetch, getGithubFileMeta, csv2array, checkUniqueKeys, summarizer, addMetadata } = require('../../lib/helper.js');

module.exports = class Downloader extends require('./prototype.js') {

	githubRepo = 'robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland';
	githubFile = 'Aktuell_Deutschland_SarsCov2_Infektionen.csv';

	constructor() {
		super('infektionen');
	}

	async checkUpdates() {
		let file = await getGithubFileMeta(this.githubRepo, this.githubFile);

		this.status.changed = (this.status.hash !== file.sha);
		this.status.newHash = file.sha;

		this.status.sources = {
			infektionen: {
				url:`https://media.githubusercontent.com/media/${this.githubRepo}/master/${this.githubFile}`, // Git LFS
			}
		}
	}

	async doUpdate() {
		let data = await fetch(this.status.sources.infektionen.url);
		
		// BOM
		if (data[0] === 0xEF) data = data.slice(3);
		
		data = csv2array(data.toString('utf8'), ',', '\r\n');

		let dataLK    = summarizer(['meldedatum','bundeslandId','landkreisId'       ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		//let dataRB    = summarizer(['meldedatum','bundeslandId','regierungsbezirkId'], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBL    = summarizer(['meldedatum','bundeslandId'                     ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDE    = summarizer(['meldedatum'                                    ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBLAlt = summarizer(['meldedatum','bundeslandId','altersgruppe'      ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDEAlt = summarizer(['meldedatum',               'altersgruppe'      ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);

		data.forEach(e => {
			let entry = {
				landkreisId: parseInt(e.IdLandkreis, 10),
				//regierungsbezirkId: /^9\d\d\d$/.test(e.IdLandkreis) ? parseInt(e.IdLandkreis[1], 10) : 0,
				bundeslandId: parseInt(e.IdLandkreis.slice(0,-3), 10),
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

			// fasse Berlin zusammen
			if ((entry.landkreisId >= 11001) && (entry.landkreisId <= 11012)) entry.landkreisId = 11000;

			dataLK.add(entry);
			dataBL.add(entry);
			dataDE.add(entry);
			dataBLAlt.add(entry);
			dataDEAlt.add(entry);

			//if (entry.regierungsbezirkId) dataRB.add(entry);
		})

		dataLK    = dataLK.get();
		//dataRB    = dataRB.get();
		dataBL    = dataBL.get();
		dataDE    = dataDE.get();
		dataBLAlt = dataBLAlt.get();
		dataDEAlt = dataDEAlt.get();

		addMetadata(dataLK,    ['deutschland','bundesland','landkreis']);
		//addMetadata(dataRB,    {bundesland:'bundeslandId', regierungsbezirk:'regierungsbezirkId'});
		addMetadata(dataBL,    ['deutschland','bundesland']);
		addMetadata(dataBLAlt, ['deutschland','bundesland']);
		addMetadata(dataDE,    ['deutschland']);
		addMetadata(dataDEAlt, ['deutschland']);

		this.saveTable('lk',     dataLK);
		//this.saveTable('rb',     dataRB);
		this.saveTable('bl',     dataBL);
		this.saveTable('de',     dataDE);
		this.saveTable('de-alt', dataDEAlt);
		this.saveTable('bl-alt', dataBLAlt);

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
