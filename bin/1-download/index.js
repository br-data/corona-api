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

	let workerDefs = [
		{ slug: 'impfungen-by',     workerFilename: './download-impfungen.js', parameter: 'by' },
		{ slug: 'impfungen-de',     workerFilename: './download-impfungen.js', parameter: 'de' },
		//{ slug: 'rkizahlen',        workerFilename: './download-rkizahlen.js' },
		{ slug: 'hospitalisierung', workerFilename: './download-hospitalisierung.js' },
	]

	for (let workerDef of workerDefs) {
		console.log('starte worker: '+workerDef.slug);

		let oldState = states[workerDef.slug] || {};
		let worker = require(workerDef.workerFilename);
		let response = await worker.update(oldState, workerDef.parameter);

		if (response) {
			changes = true;
			response.worker = workerDef.slug;
			states[workerDef.slug] = response;
		}
	}

	console.log('fertig');

	if (changes) {
		fs.writeFileSync(config.files.downloadStates, JSON.stringify(states, null, '\t'))
		return true;
	}
	
	return false;
}
