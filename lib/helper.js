"use strict"

const fs = require('fs');
const https = require('https');

module.exports = {
	fetch,
	download,
	array2csv,
	csv2array,
	saveNDJSON,
	loadNDJSON,
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

function download(url, filename, options = {}) {
	//console.log(arguments);
	return new Promise((resolve, reject) => {
		https.get(url, options, response => {
			//console.log(response);
			if (response.statusCode !== 200) {
				console.log('url:', url);
				console.log('response:', response);
			}
			let filestream = fs.createWriteStream(filename);
			filestream.on('close', resolve);
			response.pipe(filestream)
		}).on('error', e => {
			console.log(e);
			reject(e)
		})
	});
}

function array2csv(array, fieldDelimiter = ',', lineDelimiter = '\n') {
	let keys = new Set();
	array.forEach(entry => Object.keys(entry).forEach(k => keys.add(k)))
	keys = Array.from(keys.values());
	array = array.map(entry => keys.map(k => entry[k]));
	array.unshift(keys);
	return array.map(entry => entry.join(fieldDelimiter)).join(lineDelimiter);
}

function csv2array(text, fieldDelimiter = ',', lineDelimiter = '\n') {
	let data = text.split(lineDelimiter).filter(l => l.length > 0).map(l => l.split(fieldDelimiter));
	let keys = data.shift();
	return data.map(e => Object.fromEntries(keys.map((k,i) => [k,e[i]])));
}

function saveNDJSON(filename, data) {
	const count = 10000;
	data = data.slice();
	let buffers = [];
	while (data.length > 0) {
		let chunk = data.slice(0,count);
		data = data.slice(count);
		chunk = chunk.map(e => JSON.stringify(e)+'\n').join('');
		buffers.push(Buffer.from(chunk));
	}
	fs.writeFileSync(filename, Buffer.concat(buffers));
}

function loadNDJSON(filename) {

}




