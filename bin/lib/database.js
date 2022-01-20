"use strict"

const fs = require('fs');
const { resolve } = require('path');
const config = require('./config.js');
const { array2csv } = require('./helper.js');
const updateDownloader = require('../download.js').update;

module.exports = function Database() {

	let tableLookup = new Map();

	return {
		start,
		queryData,
		getStatusHTML,
		getBuilderHTML,
	}

	async function start() {
		await updateData();
		setInterval(updateData, 5*3600*1000);
	}

	async function updateData() {
		await updateDownloader();

		let folder = config.folders.tables;
		fs.readdirSync(folder).forEach(filename => {
			if (!filename.endsWith('.json')) return;

			let tableName = filename.replace(/\..*/,'');
			let fullname = resolve(folder, filename);
			let mtime = fs.statSync(fullname).mtime;

			if (!tableLookup.has(tableName)) {
				tableLookup.set(tableName, { name:tableName })
			}

			let table = tableLookup.get(tableName);

			if (table.mtime !== mtime) {
				try {
					let result = JSON.parse(fs.readFileSync(fullname));
					table.date = result.date;
					table.data = result.data;
					table.mtime = mtime;
				} catch (e) {
					console.error(e.toString());
				}
			}
		})
	}
	
	function queryData(tableName, query) {
		let table = tableLookup.get(tableName);
		if (!table) throw Error(`unknown table "${tableName}". known tables: `+Array.from(tableLookup.keys()).join(','));

		let data = table.data;

		// filter
		if (query.filter) {
			let filters = query.filter;
			if (!Array.isArray(filters)) filters = [filters];

			for (let filter of filters) {
				let match = filter.match(/^([\w-]+)([\<\>]=?|[\=\!]=)([\w-]+)$/);
				if (!match) throw Error(`malformed filter ${filter}: expecting e.g. "filter=bundeslandId=12"`);
				let key = match[1];
				let compare = match[2];
				let value = match[3];
				if (/^[0-9]+$/.test(value)) value = parseInt(value, 10);

				let filterFunction;
				switch (compare) {
					case '==': filterFunction = obj => obj[key] == value; break;
					case '!=': filterFunction = obj => obj[key] != value; break;
					case '<=': filterFunction = obj => obj[key] <= value; break;
					case '>=': filterFunction = obj => obj[key] >= value; break;
					case '<':  filterFunction = obj => obj[key] <  value; break;
					case '>':  filterFunction = obj => obj[key] >  value; break;
					default: throw Error(`unknown comparison "${compare}"`);
				}

				data = data.filter(filterFunction);
			}
		}

		// sort
		if (query.sort) {
			let sorters = query.sort;
			if (!Array.isArray(sorters)) sorters = [sorters];
			sorters.reverse();

			for (let sorter of sorters) {
				let match = sorter.match(/^([\w-]+)(=desc)?$/i);
				if (!match) throw Error(`malformed sort ${sorter}: expecting e.g. "sort=bundesland" or "sort=datum=desc"`);
				let key = match[1];
				let ascending = !match[2];
				if (ascending) {
					data.sort((a,b) => a[key] < b[key] ? -1 :  1);
				} else {
					data.sort((a,b) => a[key] < b[key] ?  1 : -1);
				}
			}
		}

		// format
		switch (query.format) {
			case 'json':
				return {
					mime:'application/json',
					body:JSON.stringify(data)
				}
			case undefined:
			case 'csv':
				return {
					mime:'text/plain',
					body:array2csv(data)
				}
			default:
				throw Error(`unknown format "${query.format}"`);
		}
	}
	
	function getStatusHTML() {

	}
	
	function getBuilderHTML() {

	}
}
