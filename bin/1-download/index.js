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
		{ slug: 'impfungen',        workerFilename: './download-impfungen.js' },
		{ slug: 'hospitalisierung', workerFilename: './download-hospitalisierung.js' },
		{ slug: 'infektionen',      workerFilename: './download-infektionen.js' },
	]

	for (let workerDef of workerDefs) {
		console.log('starte worker: '+workerDef.slug);

		let state = states[workerDef.slug] || {};
		state = JSON.parse(JSON.stringify(state)) // deep copy

		let worker = require(workerDef.workerFilename);
		state = await worker.update(state, workerDef.parameter);

		if (state.changed) {
			changes = true;
			state.worker = workerDef.slug;
			states[workerDef.slug] = state;
			saveStates();
		}
	}
	
	saveStates()

	console.log('fertig');
	
	return changes;

	function saveStates() {
		fs.writeFileSync(config.files.downloadStates, JSON.stringify(states, null, '\t'));
	}
}
