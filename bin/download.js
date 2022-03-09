"use strict"

const fs = require('fs');

const workers = [
	'hospitalisierung',
	'impfungen',
	'infektionen',
]

module.exports = {
	update,
	getLogs,
}

if (require.main === module) update();

async function update() {
	console.log('downloaders started');

	for (let worker of workers) {
		console.log(`downloader ${worker} started`);
		
		let Downloader = require(`./downloaders/downloader_${worker}.js`);
		let downloader = new Downloader();
		await downloader.run();

		console.log(`downloader ${worker} finished`);
	}

	console.log('downloaders finished');
}

function getLogs() {
	let status = {};
	for (let worker of workers) {
		let Downloader = require(`./downloaders/downloader_${worker}.js`);
		status[worker] = (new Downloader()).getLogs();
	}
	return status;
}
