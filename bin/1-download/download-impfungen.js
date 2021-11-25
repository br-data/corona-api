"use strict"

const fs = require('fs');
const config = require('../config.js');
const { fetch, download, csv2array } = require('../../lib/helper.js');
const { resolve } = require('path');


const apiUrl = 'https://api.github.com/repos/ard-data/2020-rki-impf-archive/contents/data/9_csv_v3';

module.exports = {
	update,
}

async function update(state, region) {
	console.log('   überprüfe impfungen-'+region);

	if (!state) state = {};
	if (!state.times) state.times = {};
	state.changed = false;



	let slug, gitFilename;
	switch (region.toLowerCase()) {
		case 'by': slug = 'by'; gitFilename = 'region_BY.csv'; break;
		case 'de': slug = 'de'; gitFilename = 'region_DE.csv'; break;
		default:
			console.log(`   Unbekannte Region "${region}" für Impfungen`);
			throw Error()
	}

	const rawFilename = resolve(config.folders.raw, `impfungen-${slug}.tsv`)
	const cleanedFilename = resolve(config.folders.cleaned, `impfungen-${slug}.json`);

	let isNewData = await checkData();

	if (isNewData || !fs.existsSync(rawFilename)) {
		await downloadData();
	}

	if (isNewData || !fs.existsSync(cleanedFilename)) {
		await cleanData();

		console.log('   fertig mit impfungen-'+region)
		state.changed = true;
		return state;
	}
	
	console.log('   überspringe impfungen-'+region)
	return state;
	


	async function checkData() {
		state.times.check = new Date();

		let directory = await fetch(apiUrl, { 'User-Agent': 'curl/7.64.1' })
		directory = JSON.parse(directory);
		let file = directory.find(e => e.name === gitFilename)

		if (!file) throw Error('Could not find "https://github.com/robert-koch-institut/COVID-19-impfungenen_in_Deutschland/blob/master/Aktuell_Deutschland_COVID-19-impfungenen.csv"')

		let isNewData = (state.hash !== file.sha)
		
		state.hash = file.sha;
		state.source = file.download_url;

		return isNewData
	}

	async function downloadData(url) {
		state.times.download = new Date();

		console.log('      runterladen');
		await download(state.source, rawFilename);
		console.log('      wurde runtergeladen');

		return true;
	}

	async function cleanData() {
		state.times.clean = new Date();

		console.log('      daten säubern');

		let data = fs.readFileSync(rawFilename, 'utf8');
		data = csv2array(data);

		const fields = [
			'dosen:dosen_kumulativ',
			'dosenAstrazeneca:dosen_astrazeneca_kumulativ',
			'dosenBiontech:dosen_biontech_kumulativ',
			'dosenJanssen:dosen_janssen_kumulativ',
			'dosenModerna:dosen_moderna_kumulativ',
			'impfinzidenzDosen:impf_inzidenz_dosen',
			'impfinzidenzErst:impf_inzidenz_erst',
			'impfinzidenzMin1:impf_inzidenz_min1',
			'impfinzidenzVoll:impf_inzidenz_voll',
			'impfinzidenzZweit:impf_inzidenz_zweit',
			'impfquoteDosen:impf_quote_dosen',
			'impfquoteErst:impf_quote_erst',
			'impfquoteMin1:impf_quote_min1',
			'impfquoteVoll:impf_quote_voll',
			'impfquoteZweit:impf_quote_zweit',
			'personenErst:personen_erst_kumulativ',
			'personenErstAstrazeneca:personen_erst_astrazeneca_kumulativ',
			'personenErstBiontech:personen_erst_biontech_kumulativ',
			'personenErstJanssen:personen_erst_janssen_kumulativ',
			'personenErstModerna:personen_erst_moderna_kumulativ',
			'personenMin1:personen_min1_kumulativ',
			'personenMin1Astrazeneca:personen_min1_astrazeneca_kumulativ',
			'personenMin1Biontech:personen_min1_biontech_kumulativ',
			'personenMin1Janssen:personen_min1_janssen_kumulativ',
			'personenMin1Moderna:personen_min1_moderna_kumulativ',
			'personenVoll:personen_voll_kumulativ',
			'personenVollAstrazeneca:personen_voll_astrazeneca_kumulativ',
			'personenVollBiontech:personen_voll_biontech_kumulativ',
			'personenVollJanssen:personen_voll_janssen_kumulativ',
			'personenVollModerna:personen_voll_moderna_kumulativ',
			'personenZweit:personen_zweit_kumulativ',
			'personenZweitAstrazeneca:personen_zweit_astrazeneca_kumulativ',
			'personenZweitBiontech:personen_zweit_biontech_kumulativ',
			'personenZweitJanssen:personen_zweit_janssen_kumulativ',
			'personenZweitModerna:personen_zweit_moderna_kumulativ',
		].map(f => f.split(':'));

		data = data.map(e => {
			let result = {
				datum: e.date,
				datumVeroeffentlichung: e.publication_date,
			}
			fields.forEach(f => result[f[0]] = parseFloat(e[f[1]]))
			return result;
		})

		fs.writeFileSync(cleanedFilename, JSON.stringify(data));
	}
}