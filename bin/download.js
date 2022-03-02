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

if (require.main === module) {
	let args = process.argv.slice(2);
	let cached = args.some(a => a.includes('cache'));
	if (cached) console.log('Use caching')
	update({cached});
}

async function update(opt = {}) {
	console.log('downloaders started');

	for (let worker of workers) {
		console.log(`downloader ${worker} started`);
		
		let Downloader = require(`./downloaders/downloader_${worker}.js`);
		let downloader = new Downloader();
		await downloader.run(opt);

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
