"use strict"

const { fetch, getGithubFileMeta, csv2array, checkUniqueKeys, summarizer, addMetadata } = require('../lib/helper.js');

const version = '2';

module.exports = class Downloader extends require('./prototype.js') {

	githubRepo = 'robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland';
	githubFile = 'Aktuell_Deutschland_SarsCov2_Infektionen.csv';

	constructor() {
		super('infektionen');
	}

	async checkUpdates() {
		let file = await getGithubFileMeta(this.githubRepo, this.githubFile);

		let hash = file.sha+'_'+version;
		
		this.status.changed = (this.status.hash !== hash);
		this.status.newHash = hash;

		this.status.sources = {
			infektionen: {
				url:`https://media.githubusercontent.com/media/${this.githubRepo}/master/${this.githubFile}`, // Git LFS
			}
		}
	}

	async doUpdate() {
		let data = await fetch(this.status.sources.infektionen.url);
		//let data = fs.readFileSync('temp.tmp');
		
		// BOM
		if (data[0] === 0xEF) data = data.slice(3);
		
		data = csv2array(data.toString('utf8'), ',', '\r\n');

		let dataLK    = summarizer(['meldedatum','bundeslandId','landkreisId'       ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBL    = summarizer(['meldedatum','bundeslandId'                     ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDE    = summarizer(['meldedatum'                                    ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBLAlt = summarizer(['meldedatum','bundeslandId','altersgruppe'      ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDEAlt = summarizer(['meldedatum',               'altersgruppe'      ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);

		data.forEach(e => {
			let entry = {
				landkreisId: parseInt(e.IdLandkreis, 10),
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
		})

		dataLK    = dataLK.get();
		dataBL    = dataBL.get();
		dataDE    = dataDE.get();
		dataBLAlt = dataBLAlt.get();
		dataDEAlt = dataDEAlt.get();

		addMetadata(dataLK,    ['bundeslaender', 'landkreise-einwohner']);
		addMetadata(dataBL,    ['bundeslaender-einwohner']);
		addMetadata(dataDE,    ['deutschland-einwohner']);
		addMetadata(dataBLAlt, ['bundeslaender-alter']);
		addMetadata(dataDEAlt, ['deutschland-alter']);

		calcInzidenzen(dataLK, ['landkreisId']);
		calcInzidenzen(dataBL, ['bundeslandId']);
		calcInzidenzen(dataDE);
		calcInzidenzen(dataBLAlt, ['altersgruppe','bundeslandId']);
		calcInzidenzen(dataDEAlt, ['altersgruppe']);

		this.saveTable('lk',     dataLK);
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

		function calcInzidenzen(data, groupKeys = []) {
			let groups = new Map();
			data.forEach(entry => {
				let key = groupKeys.map(k => entry[k]).join('_');
				if (!groups.has(key)) groups.set(key, []);
				groups.get(key).push(entry);
			})
			Array.from(groups.values()).forEach(list => {
				list.sort((a,b) => a.meldedatum < b.meldedatum ? -1 : 1);
				for (let i = 0; i < list.length; i++) {
					let minDatum = (new Date(Date.parse('2020-12-19 12:00') - 6*84600000)).toISOString().slice(0,10);
					let i0 = Math.max(0, i - 6);
					let sum = 0;
					let count = 0;

					for (let j = i0; j <= i; j++) {
						let entry = list[j];
						if (entry.meldedatum < minDatum) continue;
						sum += entry.anzahlFall;
						count++
					}
					let entry = list[i];
					entry.mittlere7TageInzidenz = Math.round(1e1*sum/7)/10;
					entry.inzidenz = Math.round(1e6*sum/entry.einwohnerzahl)/10;
				}
			})
		}
	}
}
