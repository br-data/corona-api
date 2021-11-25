"use strict"

const fs = require('fs');
const { resolve } = require('path');

const config = {
	folders: {
		data:    resolve(__dirname, '../data'),
		raw:     resolve(__dirname, '../data/1-external-data-raw'),
		cleaned: resolve(__dirname, '../data/2-external-data-cleaned'),
		static:  resolve(__dirname, '../data/3-static-data'),
	},
	files: {
		downloadStates: resolve(__dirname, '../data/download-states.json'),
	}
}

module.exports = config;

fs.mkdirSync(config.folders.data,    { recursive:true });
fs.mkdirSync(config.folders.raw,     { recursive:true });
fs.mkdirSync(config.folders.cleaned, { recursive:true });
