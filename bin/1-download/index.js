"use strict"

const fs = require('fs');
const config = require('../config.js');

module.exports = {
	update
}

if (require.main === module) update();

async function update() {
	let states = {};

	if (fs.existsSync(config.files.downloadStates)) {
		states = JSON.parse(fs.readFileSync(config.files.downloadStates));
	}

	let changes = false;

	let workers = [
		{ slug: 'impfungen',        workerFilename: './download-impfungen.js' },
		//{ slug: 'rkizahlen',        workerFilename: './download-rkizahlen.js' },
		{ slug: 'hospitalisierung', workerFilename: './download-hospitalisierung.js' },
	]

	for (let entry of workers) {
		console.log('starte worker: '+entry.slug);

		let oldState = states[entry.slug] || {};
		let worker = require(entry.workerFilename);
		let response = await worker.update(oldState);

		if (response) {
			changes = true;
			response.worker = entry.slug;
			states[entry.slug] = response;
		}
	}

	console.log('fertig');

	if (changes) {
		fs.writeFileSync(config.files.downloadStates, JSON.stringify(states, null, '\t'))
		return true;
	}
	
	return false;
}
