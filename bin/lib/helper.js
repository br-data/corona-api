"use strict"

const fs = require('fs');
const https = require('https');
const { resolve } = require('path');
const config = require('./config.js');

// Grundlegende Helferfunktionen

module.exports = {
	array2csv,
	checkUniqueKeys,
	csv2array,
	fetch,
	getGithubFileMeta,
	summarizer,
	cached,
}

function fetch(url, headers = {}) {
	return new Promise((resolve, reject) => {
		https.get(url, {headers}, response => {
			let buf = [];
			response.on('data', data => buf.push(data));
			response.on('end', () => {
				buf = Buffer.concat(buf);
				if (response.statusCode === 200) {
					resolve(buf);
				} else {
					console.log('url:', url);
					console.log('response:', response);
					console.log('Buffer: "'+buf.toString()+'"');
					reject(buf);
				}
			});
			response.on('error', e => { console.log(e); reject(e) });
		}).on('error', e => { console.log(e); reject(e) })
	});
}

async function getGithubFileMeta(repo, filename) {
	let directory = await fetch(
		`https://api.github.com/repos/${repo}/contents/`,
		{
			'User-Agent': 'curl/7.64.1',
			'Authorization':'Basic '+Buffer.from(config.githubAccessToken).toString('base64'),
			'Content-Type': 'application/json;charset=UTF-8',
			'Accept': 'application/vnd.github.+json',
		}
	)
	directory = JSON.parse(directory);
	let file = directory.find(e => e.name === filename)

	if (!file) throw Error(`Could not find "https://github.com/${repo}/blob/master/${filename}"`)

	return file;
}

function csv2array(text, fieldDelimiter = ',', lineDelimiter = '\n') {
	// converts a CSV into an array of objects
	let data = text.split(lineDelimiter).filter(l => l.length > 0).map(l => l.split(fieldDelimiter));
	let keys = data.shift();
	return data.map(e => Object.fromEntries(keys.map((k,i) => [k,e[i]])));
}

function sortByKeys(data, keys) {
	data.sort((a,b) => {
		for (let key of keys) if (a[key] !== b[key]) return (a[key] < b[key]) ? -1 : 1;
	})
	return data;
}

function checkUniqueKeys(data, keys) {
	// checks, if the combination of keys is unique
	// e.g.:
	//    { land:'bayern', date:'2022-01-01', … }
	//    { land:'berlin', date:'2022-01-01', … }
	//    { land:'bayern', date:'2022-01-02', … }
	//    { land:'bayern', date:'2022-01-01', … } <--- combination of keys 'land' and 'date' is a duplicate
	let unique = new Set();
	for (let entry of data) {
		let key = keys.map(k => entry[k]).join(';');
		if (unique.has(key)) return false;
		unique.add(key);
	}
	sortByKeys(data, keys);
	return true;
}

function summarizer(primaryKeys, numericKeys) {
	let map = new Map();

	return { add, get }
	
	function add(entry) {
		let keyString = primaryKeys.map(k => entry[k]).join(';');
		if (!map.has(keyString)) {
			let obj = {};
			primaryKeys.forEach(k => obj[k] = entry[k]);
			numericKeys.forEach(  k => obj[k] = entry[k]);
			map.set(keyString, obj);
		} else {
			let obj = map.get(keyString);
			numericKeys.forEach(k => obj[k] += entry[k]);
		}
	}

	function get(opt = {}) {
		if (opt.fillGaps) fillGaps(opt.fillGaps);

		let data = Array.from(map.values());
		return sortByKeys(data, primaryKeys);
	}

	function fillGaps(keys) {
		/*
			Fügt nicht vorhandene Primay-Key-Kombinationen hinzu. Beispiel:
			{a:0,b:0,v:13},
			{a:0,b:1,v:14},
			{a:1,b:1,v:15},
			{a:1,b:2,v:16}
			Wären a und b die primaryKeys, dann wären für a die Werte [0,1] und b die Werte [0,1,2] definiert.
			Damit wären 2*3=6 Kombinationen möglich, aber nur 4 sind angegeben.
			Dementsprechend würde fillGaps die fehlenden Einträge hinzufügen und v als numericKey auf 0 setzen:
			{a:0,b:2,v:0},
			{a:1,b:0,v:0},
		*/

		if (!Array.isArray(keys)) keys = primaryKeys;

		if (keys.length < 2) return;

		// scan keys
		keys = keys.map(key => ({key,values:new Set()}));


		// scan all known values for each key
		for (let entry of map.values()) {
			keys.forEach(({key,values}) => values.add(entry[key]));
		}

		// generate all possible combinations of key values
		let combinations = false;
		keys.forEach(({key,values}) => {
			values = Array.from(values.values());
			values.sort((a,b) => a < b ? -1 : 1);
			if (!combinations) {
				combinations = values.map(v => Object.fromEntries([[key,v]]));
			} else {
				let newCombinations = [];
				combinations.forEach(obj => {
					values.forEach(value => {
						obj = Object.assign({},obj);
						obj[key] = value;
						newCombinations.push(obj);
					})
				})
				combinations = newCombinations;
			}
		});

		// add zeros for all sum fields
		combinations.forEach(obj => {
			let keyString = primaryKeys.map(k => obj[k]).join(';');
			if (map.has(keyString)) return;
			numericKeys.forEach(k => obj[k] = 0);
			map.set(keyString, obj);
		})
	}
}

function array2csv(list) {
	let keys = new Set();
	list.forEach(obj => Object.keys(obj).forEach(key => keys.add(key)));
	keys = Array.from(keys.values());
	let csv = list.map(obj => keys.map(key => {
		let value = obj[key];
		if ((typeof value === 'string') && (value.includes(','))) value = '"'+value+'"';
		return value;
	}).join(','));
	csv.unshift(keys.join(','));
	return csv.join('\n');
}

async function cached(key, cb) {
	let cacheFilename = resolve(config.folders.cache, key+'.tmp');
	if (fs.existsSync(cacheFilename)) return fs.readFileSync(cacheFilename);
	let result = cb();
	if (result.then) result = await result;
	fs.writeFileSync(cacheFilename, result);
	return result;
}
