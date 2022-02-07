"use strict"

const fs = require('fs');
const { resolve } = require('path');

const config = {
	folders: {
		data:    resolve(__dirname, '../../data'),
		status:  resolve(__dirname, '../../data/status'),
		log:     resolve(__dirname, '../../data/log'),
		tables:  resolve(__dirname, '../../data/tables'),
		static:  resolve(__dirname, '../../data/static'),
	},
	// generate on at: https://github.com/settings/tokens/new
	githubAccessToken: 'michaelkreil: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',
	updateEvery: 10*60*1000,
}

module.exports = config;

fs.mkdirSync(config.folders.data,   { recursive:true });
fs.mkdirSync(config.folders.status, { recursive:true });
fs.mkdirSync(config.folders.log,    { recursive:true });
fs.mkdirSync(config.folders.tables, { recursive:true });
fs.mkdirSync(config.folders.static, { recursive:true });
