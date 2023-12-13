import fetch from 'node-fetch';

import { Downloader } from './downloader';
import { csv2array } from '../lib/helper';
import { GenericObject } from '../lib/types';
import stateMap from '../../static/bundeslaender-divi.json';

export class DownloaderIntensivpatienten extends Downloader {
  constructor() {
    super('intensivpatienten');
  }

  async checkUpdates() {

    // Check if the dataset already contains the la
    const currentDate = new Date();
    this.status.changed =
      this.status.lastDate !== currentDate.toISOString().split('T')[0];

    this.status.sources = {
      intensivpatienten: {
        urlDE:
        'https://raw.githubusercontent.com/robert-koch-institut/Intensivkapazitaeten_und_COVID-19-Intensivbettenbelegung_in_Deutschland/main/Intensivregister_Bundeslaender_Kapazitaeten.csv',
        urlBL:
        'https://raw.githubusercontent.com/robert-koch-institut/Intensivkapazitaeten_und_COVID-19-Intensivbettenbelegung_in_Deutschland/main/Intensivregister_Bundeslaender_Kapazitaeten.csv',
      }
    };
  }

  async doUpdate() {
    const csvBL = await fetch(this.status.sources.intensivpatienten.urlBL);
    const arrayBL = csv2array(await csvBL.text());

    const csvDE = await fetch(this.status.sources.intensivpatienten.urlDE);
    const arrayDE = csv2array(await csvDE.text());

    const dataBL = this.transformData(arrayBL, true);
    const dataDE = this.transformData(arrayDE, false);

    const lastDateBL = this.getLastDate(dataBL);
    const lastDateDE = this.getLastDate(dataDE);

    // Set latest date found in the dataset
    this.status.lastDate =
      new Date(lastDateBL) < new Date(lastDateDE) ? lastDateBL : lastDateDE;

    // @TODO Implement key checking
    // if (!checkUniqueKeys(dataBL,   ['datum','bundeslandId'])) throw Error();
    // if (!checkUniqueKeys(dataDE,   ['datum'])) throw Error();

    this.addMetadata(dataBL, ['bundeslaender']);
    this.addMetadata(dataDE, ['deutschland-einwohner']);

    this.saveTable('bl', dataBL);
    this.saveTable('de', dataDE);
  }

  transformData(data: GenericObject[], hasStates = true) {
   
    const states = hasStates ? stateMap : [];

    return data
      .filter((d) => d.behandlungsgruppe === 'Erwachsene')
      .map((d) => ({
        datum: d.datum,
        ...(hasStates && {
          bundesland: d.bundesland_name,
          bundeslandId: d.bundesland_id
        }),
        anzahlIntensivpatienten: parseInt(d.faelle_covid_aktuell, 10),
        anzahlMeldebereiche: parseInt(d.anzahl_meldebereiche, 10),
        bettenBelegt: parseInt(d.intensivbetten_belegt, 10),
        bettenFrei: parseInt(d.intensivbetten_frei, 10),
        bettenReserve: parseInt(d.intensivbetten_7_tage_notfallreserve, 10),
        situationNormal: parseInt(d.betriebssituation_regulaerer_betrieb, 10),
        situationEingeschraenkt: parseInt(
          d.betriebssituation_teilweise_eingeschraenkt,
          10
        ),
        situationTeilweiseEingeschraenkt: parseInt(
          d.betriebssituation_eingeschraenkt,
          10
        ),
        situationUnbekannt: parseInt(d.betriebssituation_keine_angabe, 10)
      }));
  }

  getLastDate(data: GenericObject[]) {
    return data[data.length - 1].datum;
  }
}
