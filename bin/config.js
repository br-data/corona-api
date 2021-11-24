"use strict"

const { resolve } = require('path');

module.exports = {
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




