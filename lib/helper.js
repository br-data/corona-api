"use strict"

const fs = require('fs');
const https = require('https');

module.exports = {
	fetch,
	getGithubFileMeta,
	//download,
	//array2csv,
	csv2array,
	//saveJSON,
	//saveNDJSON,
	//loadNDJSON,
	summarizer,
	checkUniqueKeys,
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
	let directory = await fetch(`https://api.github.com/repos/${repo}/contents/`, { 'User-Agent': 'curl/7.64.1' })
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
	return true;
}

function summarizer(groupFields, sumFields) {
	let map = new Map();

	return { add, get }
	
	function add(entry) {
		let key = groupFields.map(k => entry[k]).join(';');
		if (!map.has(key)) {
			let obj = {};
			groupFields.forEach(k => obj[k] = entry[k]);
			sumFields.forEach(  k => obj[k] = entry[k]);
			map.set(key, obj);
		} else {
			let obj = map.get(key);
			sumFields.forEach(k => obj[k] += entry[k]);
		}
	}

	function get() {
		return Array.from(map.values());
	}
}
