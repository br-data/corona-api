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
		//{ slug: 'impfungen-by',     workerFilename: './download-impfungen.js', parameter: 'by' },
		//{ slug: 'impfungen-de',     workerFilename: './download-impfungen.js', parameter: 'de' },
		//{ slug: 'hospitalisierung', workerFilename: './download-hospitalisierung.js' },
		{ slug: 'infektionen',      workerFilename: './download-infektionen.js' },
	]

	for (let workerDef of workerDefs) {
		console.log('starte worker: '+workerDef.slug);

		let state = states[workerDef.slug] || {};
		let worker = require(workerDef.workerFilename);
		state = await worker.update(state, workerDef.parameter);

		if (state.changed) {
			changes = true;
			response.worker = workerDef.slug;
			states[workerDef.slug] = state;
		}
	}

	console.log('fertig');

	fs.writeFileSync(config.files.downloadStates, JSON.stringify(states, null, '\t'));
	
	return changes;
}
