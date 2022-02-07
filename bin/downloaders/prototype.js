"use strict"

const config = require('../lib/config.js');
const fs = require('fs');
const { resolve } = require('path');
const { fetch } = require('../lib/helper.js');

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
			console.error('   check for updates');
			await this.checkUpdates();

			if (this.status.changed) {
				// new data
				console.error('   update started');
				await this.doUpdate()
				console.error('   update finished');
			} else {
				// no new data
				console.error('   no updates');
			}
			
			this.status.hash = this.status.newHash;

		} catch (e) {
			// error handling
			this.status.error = e.toString();
			console.error(e);
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
		data = {
			date: Date.now(),
			data,
		}
		fs.writeFileSync(filename, JSON.stringify(data));
	}
}
