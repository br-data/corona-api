"use strict"

const fs = require('fs');
const https = require('https');

module.exports = {
	addMetadata,
	array2csv,
	checkUniqueKeys,
	csv2array,
	fetch,
	getGithubFileMeta,
	summarizer,
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

function addMetadata(data, fields) {

	fields.forEach(field => {
		let cacheAltergruppen = new Map();

		switch (field) {
			case 'deutschland-einwohner': {
				let deutschland = JSON.parse(fs.readFileSync('../data/static/deutschland-einwohner.json'));
				data.forEach(e => Object.assign(e, deutschland));
			} break;

			case 'deutschland-alter': {
				let deutschland = JSON.parse(fs.readFileSync('../data/static/deutschland-alter.json'));
				data.forEach(e => {
					e.einwohnerzahl = getAltergruppen(e.altersgruppe, e.altersgruppe, deutschland.einwohnerzahl)
				});
			} break;

			case 'bundeslaender': {
				let bundeslaender = JSON.parse(fs.readFileSync('../data/static/bundeslaender.json'));
				data.forEach(e => Object.assign(e, bundeslaender[e.bundeslandId]));
			} break;

			case 'bundeslaender-einwohner': {
				let bundeslaender = JSON.parse(fs.readFileSync('../data/static/bundeslaender-einwohner.json'));
				data.forEach(e => Object.assign(e, bundeslaender[e.bundeslandId]));
			} break;

			case 'bundeslaender-alter': {
				let bundeslaender = JSON.parse(fs.readFileSync('../data/static/bundeslaender-alter.json'));
				data.forEach(e => {
					let obj = Object.assign({}, bundeslaender[e.bundeslandId]);
					obj.einwohnerzahl = getAltergruppen(e.bundeslandId+'_'+e.altersgruppe, e.altersgruppe, obj.einwohnerzahl)
					Object.assign(e, obj);
				});
			} break;

			case 'landkreise': {
				let landkreise = JSON.parse(fs.readFileSync('../data/static/landkreise.json'));
				data.forEach(e => Object.assign(e, landkreise[e.landkreisId]));
			} break;

			case 'landkreise-einwohner': {
				let landkreise = JSON.parse(fs.readFileSync('../data/static/landkreise-einwohner.json'));
				data.forEach(e => Object.assign(e, landkreise[e.landkreisId]));
			} break;

			default: throw Error('unknown metadata type: '+field)
		}

		function getAltergruppen(key, gruppe, einwohnerzahl) {
			if (gruppe === 'unbekannt') return 0;

			if (cacheAltergruppen.has(key)) return cacheAltergruppen.get(key);

			let match, i0 = 0, i1 = einwohnerzahl.length-1;
			if (match = gruppe.match(/^(\d+)-(\d+)$/)) {
				i0 = parseInt(match[1], 10);
				i1 = parseInt(match[2], 10);
			} else if (match = gruppe.match(/^(\d+)\+$/)) {
				i0 = parseInt(match[1], 10);
			} else {
				throw Error(`unknown altersgruppe "${gruppe}"`)
			}

			let sum = 0;
			for (let i = i0; i <= i1; i++) sum += einwohnerzahl[i];
			cacheAltergruppen.set(key, sum);

			return key;
		}
	})
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
