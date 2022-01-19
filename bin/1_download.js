"use strict"

const fs = require('fs');

module.exports = {
	update
}

if (require.main === module) update();

async function update() {
	console.error('downloaders started');

	let workers = [
		'hospitalisierung',
		'impfungen',
		'infektionen',
	]

	for (let worker of workers) {
		console.error(`downloader ${worker} started`);
		
		let Downloader = require(`./downloaders/downloader_${worker}.js`);
		let downloader = new Downloader();
		await downloader.run();

		console.error(`downloader ${worker} finished`);
	}

	console.error('downloaders finished');
}
