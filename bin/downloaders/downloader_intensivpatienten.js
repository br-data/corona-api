"use strict"

const fs = require('fs');
const { resolve } = require('path');
const { fetch, csv2array, checkUniqueKeys, cached } = require('../lib/helper.js');
const config = require('../lib/config.js');

module.exports = class Downloader extends require('./prototype.js') {

	constructor() {
		super('intensivpatienten');
	}

	async checkUpdates() {
		this.status.changed = true;

		// @TODO Implement version checks to prevent unnecessary updates
		// const hash = file.sha+'_'+config.version;
		// this.status.changed = (this.status.hash !== hash);
		// this.status.newHash = hash;

		this.status.sources = {
			intensivpatienten: {
				urlDE: 'https://diviexchange.blob.core.windows.net/%24web/zeitreihe-deutschland.csv',
				urlBL: 'https://diviexchange.blob.core.windows.net/%24web/zeitreihe-bundeslaender.csv'
			}
		}
	}

	async doUpdate(opt = {}) {
		const loadTableBL = () => fetch(this.status.sources.intensivpatienten.urlBL);
		const tableBL = await (opt.cached ? cached('intensivpatienten', loadTableBL) : loadTableBL());
		const arrayBL = csv2array(tableBL.toString('utf8'));

		const loadTableDE = () => fetch(this.status.sources.intensivpatienten.urlDE);
		const tableDE = await (opt.cached ? cached('intensivpatienten', loadTableDE) : loadTableDE());
		const arrayDE = csv2array(tableDE.toString('utf8'));

		const dataBL = this.transformData(arrayBL, true);
		const dataDE = this.transformData(arrayDE, false);

		// @TODO Implement key checking
		// if (!checkUniqueKeys(dataBL,   ['datum','bundeslandId'])) throw Error();
		// if (!checkUniqueKeys(dataDE,   ['datum'])) throw Error();
		
		this.addMetadata(dataBL, ['bundeslaender']);
		this.addMetadata(dataDE, ['deutschland-einwohner']);

		this.saveTable('bl', dataBL);
		this.saveTable('de', dataDE);
	}

	transformData(data, hasStates = true) {
		const states = hasStates ? JSON.parse(fs.readFileSync(
			resolve(config.folders.static, 'bundeslaender-divi.json')
		)) : [];

		return data
			.filter(d => d.Behandlungsgruppe === "ERWACHSENE")
			.map(d => ({
				datum: d.Datum.split('T')[0],
				...(hasStates && {
					bundesland: states[d.Bundesland].bundesland,
					bundeslandId: states[d.Bundesland].bundeslandId,
				}),
				anzahlIntensivpatienten: parseInt(d.Aktuelle_COVID_Faelle_ITS),
				anzahlMeldebereiche: parseInt(d.Anzahl_Meldebereiche),
				bettenBelegt: parseInt(d.Belegte_Intensivbetten),
				bettenFrei: parseInt(d.Freie_Intensivbetten),
				bettenReserve: parseInt(d['7_Tage_Notfallreserve']),
				situationNormal: parseInt(d.Betriebssituation_Regulaerer_Betrieb),
				situationEingeschraenkt: parseInt(d.Betriebssituation_Teilweise_Eingeschraenkt),
				situationTeilweiseEingeschraenkt: parseInt(d.Betriebssituation_Eingeschraenkt),
				situationUnbekannt: parseInt(d.Betriebssituation_Keine_Angabe),
			}))
	}
}
