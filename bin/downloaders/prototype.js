"use strict"

const config = require('../lib/config.js');
const fs = require('fs');
const { resolve } = require('path');

module.exports = class Downloader {
	constructor(name) {
		this.name = name;
		this.statusFilename = resolve(config.folders.status, this.name+'.json');
	}
	
	async run() {
		// Lade den letzten Status
		this.loadStatus();
		this.status.error = false;

		try {
			console.log('   check for updates');
			await this.checkUpdates();

			if (this.status.changed) {
				// new data
				console.log('   update started');
				await this.doUpdate()
				console.log('   update finished');
			} else {
				// no new data
				console.log('   no updates');
			}
			
			this.status.hash = this.status.newHash;

		} catch (e) {
			// error handling
			this.status.error = e.toString();
			console.log(e);
		}

		// Speichere den aktuellen Status
		this.saveStatus();
	}

	loadStatus() {
		// Lade das letzte Status-Objekt, bzw. erstelle ein neues Status-Objekt
		if (fs.existsSync(this.statusFilename)) {
			this.status = JSON.parse(fs.readFileSync(this.statusFilename));
		} else {
			this.status = {};
		}
		this.status.dateStart = Date.now();
	}

	saveStatus() {
		// Speicher das Status-Objekt

		this.status.name = this.name;
		this.status.dateEnd = Date.now();

		let file = JSON.stringify(this.status);
		let timestamp = (new Date()).toISOString().slice(0,23).replace(/\D/g,'-');
		let logFilename = resolve(config.folders.log, `${timestamp}-${this.name}.json`);

		fs.writeFileSync(this.statusFilename, file);
		fs.writeFileSync(logFilename, file);
	}

	saveTable(slug, data) {
		// Speichere die Daten-Tabelle
		
		let filename = resolve(config.folders.tables, `${this.name}-${slug}.json`);
		data = '[\n\t'+data.map(e => JSON.stringify(e)).join(',\n\t')+'\n]';
		data = `{"date":${Date.now()},"data":${data}}`;
		fs.writeFileSync(filename, data);
	}

	addMetadata(data, fields) {
		let dataFolder = config.folders.static;

		fields.forEach(field => {
			let cacheAltergruppen = new Map();

			switch (field) {
				case 'deutschland-einwohner': {
					let deutschland = JSON.parse(fs.readFileSync(resolve(dataFolder, 'deutschland-einwohner.json')));
					data.forEach(e => Object.assign(e, deutschland));
				} break;

				case 'deutschland-alter': {
					let deutschland = JSON.parse(fs.readFileSync(resolve(dataFolder, 'deutschland-alter.json')));
					data.forEach(e => {
						e.einwohnerzahl = getAltergruppen(e.altersgruppe, e.altersgruppe, deutschland.einwohnerzahl)
					});
				} break;

				case 'bundeslaender': {
					let bundeslaender = JSON.parse(fs.readFileSync(resolve(dataFolder, 'bundeslaender.json')));
					data.forEach(e => Object.assign(e, bundeslaender[e.bundeslandId]));
				} break;

				case 'bundeslaender-einwohner': {
					let bundeslaender = JSON.parse(fs.readFileSync(resolve(dataFolder, 'bundeslaender-einwohner.json')));
					data.forEach(e => Object.assign(e, bundeslaender[e.bundeslandId]));
				} break;

				case 'bundeslaender-alter': {
					let bundeslaender = JSON.parse(fs.readFileSync(resolve(dataFolder, 'bundeslaender-alter.json')));
					data.forEach(e => {
						let obj = Object.assign({}, bundeslaender[e.bundeslandId]);
						obj.einwohnerzahl = getAltergruppen(e.bundeslandId+'_'+e.altersgruppe, e.altersgruppe, obj.einwohnerzahl)
						Object.assign(e, obj);
					});
				} break;

				case 'regierungsbezirke-einwohner': {
					let landkreise = JSON.parse(fs.readFileSync(resolve(dataFolder, 'landkreise-einwohner.json')));
					let landkreis2regierungsbezirk = JSON.parse(fs.readFileSync(resolve(dataFolder, 'regierungsbezirke.json')));
					let regierungsbezirke = new Map();
					Object.entries(landkreis2regierungsbezirk).forEach(([landkreisId,regierungsbezirk]) => {
						if (!regierungsbezirke.has(regierungsbezirk)) regierungsbezirke.set(regierungsbezirk, {einwohnerzahl:0})
						regierungsbezirke.get(regierungsbezirk).einwohnerzahl += landkreise[landkreisId].einwohnerzahl;
					})
					data.forEach(e => Object.assign(e, regierungsbezirke.get(e.regierungsbezirk)));
				} break;

				case 'landkreise': {
					let landkreise = JSON.parse(fs.readFileSync(resolve(dataFolder, 'landkreise.json')));
					data.forEach(e => Object.assign(e, landkreise[e.landkreisId]));
				} break;

				case 'landkreise-einwohner': {
					let landkreise = JSON.parse(fs.readFileSync(resolve(dataFolder, 'landkreise-einwohner.json')));
					data.forEach(e => Object.assign(e, landkreise[e.landkreisId]));
				} break;

				default: throw Error('unknown metadata type: '+field)
			}

			function getAltergruppen(key, gruppe, einwohnerzahl) {
				if (gruppe === 'unbekannt') return 0;

				if (cacheAltergruppen.has(key)) return cacheAltergruppen.get(key);

				let match, i0 = 0, i1 = einwohnerzahl.length-1;
				if (match = gruppe.match(/^(\d+)-(\d+)$/)) {
					i0 = parseInt(match[1], 10);
					i1 = parseInt(match[2], 10);
				} else if (match = gruppe.match(/^(\d+)\+$/)) {
					i0 = parseInt(match[1], 10);
				} else {
					throw Error(`unknown altersgruppe "${gruppe}"`)
				}

				let sum = 0;
				for (let i = i0; i <= i1; i++) sum += einwohnerzahl[i];
				cacheAltergruppen.set(key, sum);

				return key;
			}
		})
	}

	getLogs() {
		// behalte nur Logdateien, die nicht älter als 1 Woche sind
		let minTime = Date.now() - 7*86400000;

		// Lade Log-Dateien
		let logs = [];
		fs.readdirSync(config.folders.log).forEach(f => {
			if (!f.endsWith(this.name+'.json')) return;
			let filename = resolve(config.folders.log, f);
			try {
				let status = JSON.parse(fs.readFileSync(filename));

				if (status.dateStart < minTime) return fs.rmSync(filename);
				
				logs.push(status);
			} catch (e) {
				
			}
		})

		logs.sort((a,b) => a.dateStart - b.dateStart);

		return logs;
	}
}
