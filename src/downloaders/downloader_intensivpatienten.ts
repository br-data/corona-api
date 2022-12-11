import fs from 'fs';
import fetch from 'node-fetch';

import { resolve } from 'path';
import { Downloader } from './downloader';
import { csv2array } from '../lib/helper';
import { config } from '../lib/config';
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
          'https://diviexchange.blob.core.windows.net/%24web/zeitreihe-deutschland.csv',
        urlBL:
          'https://diviexchange.blob.core.windows.net/%24web/zeitreihe-bundeslaender.csv'
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
      .filter((d) => d.Behandlungsgruppe === 'ERWACHSENE')
      .map((d) => ({
        datum: d.Datum.split('T')[0],
        ...(hasStates && {
          bundesland: states[d.Bundesland].bundesland,
          bundeslandId: states[d.Bundesland].bundeslandId
        }),
        anzahlIntensivpatienten: parseInt(d.Aktuelle_COVID_Faelle_ITS, 10),
        anzahlMeldebereiche: parseInt(d.Anzahl_Meldebereiche, 10),
        bettenBelegt: parseInt(d.Belegte_Intensivbetten, 10),
        bettenFrei: parseInt(d.Freie_Intensivbetten, 10),
        bettenReserve: parseInt(d['7_Tage_Notfallreserve'], 10),
        situationNormal: parseInt(d.Betriebssituation_Regulaerer_Betrieb, 10),
        situationEingeschraenkt: parseInt(
          d.Betriebssituation_Teilweise_Eingeschraenkt,
          10
        ),
        situationTeilweiseEingeschraenkt: parseInt(
          d.Betriebssituation_Eingeschraenkt,
          10
        ),
        situationUnbekannt: parseInt(d.Betriebssituation_Keine_Angabe, 10)
      }));
  }

  getLastDate(data: GenericObject[]) {
    return data[data.length - 1].datum;
  }
}
