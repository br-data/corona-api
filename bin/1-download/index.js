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
		{ name: 'hospitalisierung', workerFilename: './download-hospitalisierung.js' },
		//{ name: 'impfungen',        workerFilename: './download-impfungen.js' },
		//{ name: 'infektionen',      workerFilename: './download-infektionen.js' },
	]

	for (let workerDef of workerDefs) {

		console.log('starte Downloader: '+workerDef.name);

		let state = states[workerDef.name] || {};
		state = JSON.parse(JSON.stringify(state)) // deep copy
		if (!state.times) state.times = {};
		state.changed = false;
		state.worker = workerDef.name;



		let downloader = require(workerDef.workerFilename)();
		
		console.log('      suche nach Updates');
		state.times.checkStart = new Date();
		let isNewData = await downloader.checkUpdates(state);
		state.times.checkEnd = new Date();
		console.log('      neue Updates: '+(isNewData ? 'ja' : 'nein'));
		
		let rawFilenames = Object.values(state.sources).map(s => s.filename);
		if (isNewData || rawFilenames.some(f => !fs.existsSync(f))) {
			console.log('      runterladen');
			state.times.downloadStart = new Date();
			await downloader.downloadData(state);
			state.times.downloadStart = new Date();
			console.log('      wurde runtergeladen');
		}

		let cleanedFilenames = Object.values(downloader.cleanedFilenames);
		if (isNewData || cleanedFilenames.some(f => !fs.existsSync(f))) {
			
			console.log('      daten säubern');
			state.times.cleanStart = new Date();
			await downloader.cleanData(state);
			state.times.cleanEnd = new Date();
			console.log('      daten gesäubert');

			console.log('   Downloader fertig: '+workerDef.name)

			state.changed = true;
			states[workerDef.name] = state;
			saveStates();

			changes = true;
		} else {
			console.log('   überspringe '+workerDef.name)
		}
	}
	
	saveStates()

	console.log('fertig');
	
	return changes;

	function saveStates() {
		fs.writeFileSync(config.files.downloadStates, JSON.stringify(states, null, '\t'));
	}
}
