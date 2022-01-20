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

	loadStatus() {
		if (fs.existsSync(this.statusFilename)) {
			this.status = JSON.parse(fs.readFileSync(this.statusFilename));
		} else {
			this.status = {};
		}
		this.status.dateStart = Date.now();
	}

	saveStatus() {
		this.status.name = this.name;
		this.status.dateEnd = Date.now();

		let file = JSON.stringify(this.status);
		let timestamp = (new Date()).toISOString().slice(0,23).replace(/\D/g,'-');
		let logFilename = resolve(config.folders.log, `${timestamp}-${this.name}.json`);

		fs.writeFileSync(this.statusFilename, file);
		fs.writeFileSync(logFilename, file);
	}

	saveTable(slug, data) {
		let filename = resolve(config.folders.tables, `${this.name}-${slug}.json`);
		data = {
			date: Date.now(),
			data,
		}
		fs.writeFileSync(filename, JSON.stringify(data));
	}
	
	async run() {
		this.loadStatus();
		this.status.error = false;

		try {

			console.error('   check for updates');
			await this.checkUpdates();

			if (this.status.changed) {
				console.error('   update started');
				await this.doUpdate()
				console.error('   update finished');
			} else {
				console.error('   no updates');
			}
			
			this.status.hash = this.status.newHash;

		} catch (e) {
			this.status.error = e.toString();
			console.error(e);
		}

		this.saveStatus();
	}
}
