"use strict"

const fs = require('fs');

module.exports = {
	update
}

if (require.main === module) {
	let args = process.argv.slice(2);
	let cached = args.some(a => a.includes('cache'));
	if (cached) console.log('Use caching')
	update({cached});
}

async function update(opt = {}) {
	console.log('downloaders started');

	let workers = [
		'hospitalisierung',
		'impfungen',
		'infektionen',
	]

	for (let worker of workers) {
		console.log(`downloader ${worker} started`);
		
		let Downloader = require(`./downloaders/downloader_${worker}.js`);
		let downloader = new Downloader();
		await downloader.run(opt);

		console.log(`downloader ${worker} finished`);
	}

	console.log('downloaders finished');
}
