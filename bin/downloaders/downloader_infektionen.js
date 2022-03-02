"use strict"

const fs = require('fs');
const { resolve } = require('path');
const config = require('../lib/config.js');
const { fetch, getGithubFileMeta, csv2array, summarizer, cached } = require('../lib/helper.js');

module.exports = class Downloader extends require('./prototype.js') {

	githubRepo = 'robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland';
	githubFile = 'Aktuell_Deutschland_SarsCov2_Infektionen.csv';

	constructor() {
		super('infektionen');
	}

	async checkUpdates() {
		let file = await getGithubFileMeta(this.githubRepo, this.githubFile);

		// Die Versionsnummer wird den Datei-Hashes angefügt.
		// Wenn man sie erhöht, erzwingt man einen Datenupdate.
		let hash = file.sha+'_'+config.version;
		
		this.status.changed = (this.status.hash !== hash);
		this.status.newHash = hash;

		this.status.sources = {
			infektionen: {
				url:`https://media.githubusercontent.com/media/${this.githubRepo}/master/${this.githubFile}`, // Git LFS
			}
		}
	}

	async doUpdate(opt = {}) {
		console.log('      download');

		let loadData = () => fetch(this.status.sources.infektionen.url);
		let data = await (opt.cached ? cached('infektionen', loadData) : loadData());
		
		// BOM
		if (data[0] === 0xEF) data = data.slice(3);

		console.log('      process');
		
		data = csv2array(data.toString('utf8'), ',', '\r\n');

		let dataLK    = summarizer(['meldedatum','landkreisId'                ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataRB    = summarizer(['meldedatum','regierungsbezirk'           ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBL    = summarizer(['meldedatum','bundeslandId'               ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDE    = summarizer(['meldedatum'                              ], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataBLAlt = summarizer(['meldedatum','bundeslandId','altersgruppe'], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);
		let dataDEAlt = summarizer(['meldedatum',               'altersgruppe'], ['anzahlFall','anzahlTodesfall','anzahlGenesen']);

		let regierungsbezirke = JSON.parse(fs.readFileSync(resolve(config.folders.static, 'regierungsbezirke.json')));
		
		data.forEach(e => {
			let landkreisId = parseInt(e.IdLandkreis, 10);
			let entry = {
				landkreisId,
				bundeslandId: parseInt(e.IdLandkreis.slice(0,-3), 10),
				regierungsbezirk: regierungsbezirke[landkreisId],
				altersgruppe: cleanAltersgruppe(e.Altersgruppe),
				//geschlecht: e.Geschlecht.toLowerCase(),
				meldedatum: e.Meldedatum,
				//refdatum: e.Refdatum,
				//istErkrankungsbeginn: parseInt(e.IstErkrankungsbeginn, 10),
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
			if (entry.regierungsbezirk) dataRB.add(entry);
		})

		console.log('      finalize');

		dataLK    = dataLK.get({fillGaps:true});
		dataRB    = dataRB.get({fillGaps:true});
		dataBL    = dataBL.get({fillGaps:true});
		dataDE    = dataDE.get({fillGaps:true});
		dataBLAlt = dataBLAlt.get({fillGaps:true});
		dataDEAlt = dataDEAlt.get({fillGaps:true});

		this.addMetadata(dataLK,    ['bundeslaender', 'landkreise-einwohner']);
		this.addMetadata(dataRB,    ['regierungsbezirke-einwohner']);
		this.addMetadata(dataBL,    ['bundeslaender-einwohner']);
		this.addMetadata(dataDE,    ['deutschland-einwohner']);
		this.addMetadata(dataBLAlt, ['bundeslaender-alter']);
		this.addMetadata(dataDEAlt, ['deutschland-alter']);

		calcInzidenzenUndSummen(dataLK, ['landkreisId']);
		calcInzidenzenUndSummen(dataRB, ['regierungsbezirk']);
		calcInzidenzenUndSummen(dataBL, ['bundeslandId']);
		calcInzidenzenUndSummen(dataDE);
		calcInzidenzenUndSummen(dataBLAlt, ['altersgruppe','bundeslandId']);
		calcInzidenzenUndSummen(dataDEAlt, ['altersgruppe']);

		console.log('      save');

		this.saveTable('lk',     dataLK);
		this.saveTable('rb',     dataRB);
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

		function calcInzidenzenUndSummen(data, groupKeys = []) {
			let groups = new Map();
			data.forEach(entry => {
				let key = groupKeys.map(k => entry[k]).join('_');
				if (!groups.has(key)) groups.set(key, []);
				groups.get(key).push(entry);
			})
			Array.from(groups.values()).forEach(list => {
				list.sort((a,b) => a.meldedatum < b.meldedatum ? -1 : 1);

				// Berechne Inzidenzen
				for (let i = 0; i < list.length; i++) {
					let entry0 = list[i];
					let minDatum = (new Date(Date.parse(entry0.meldedatum) - 6.1*84600000)).toISOString().slice(0,10);
					let j0 = Math.max(0, i - 6);
					let sum = 0;
					let count = 0;

					for (let j = j0; j <= i; j++) {
						let entry1 = list[j];
						if (entry1.meldedatum < minDatum) continue;
						sum += entry1.anzahlFall;
						count++
					}
					entry0.mittlere7TageInfektionen = Math.round(10*sum/7)/10;
					entry0.inzidenz = Math.round(1e6*sum/entry0.einwohnerzahl)/10;
				}

				// Berechne aggregierte Faelle
				for (let i = 0; i < list.length; i++) {
					let entry = list[i];
					entry.summeFall      = entry.anzahlFall;
					entry.summeTodesfall = entry.anzahlTodesfall;
					entry.summeGenesen   = entry.anzahlGenesen;

					if (i === 0) continue;

					entry.summeFall      += list[i-1].summeFall;
					entry.summeTodesfall += list[i-1].summeTodesfall;
					entry.summeGenesen   += list[i-1].summeGenesen;
				}
			})
		}
	}
}
