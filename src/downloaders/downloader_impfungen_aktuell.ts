import fetch from 'node-fetch';

import { getGithubFileMeta, csv2array } from '../lib/helper';
import { Downloader } from './downloader';
import { GenericObject } from '../lib/types';
import { config } from '../lib/config';

export class DownloaderImpfungenAktuell extends Downloader {
  githubRepo = 'robert-koch-institut/COVID-19-Impfungen_in_Deutschland';
  githubFile = 'Aktuell_Deutschland_Impfquoten_COVID-19.csv';

  constructor() {
    super('impfungen');
  }

  async checkUpdates() {
    const file = await getGithubFileMeta(this.githubRepo, this.githubFile);

    // Die Versionsnummer wird den Datei-Hashes angefügt.
    // Wenn man sie erhöht, erzwingt man einen Datenupdate.
    const hash = file.sha + '_' + config.version;

    this.status.changed = this.status.hash !== hash;

    this.status.newHash = hash;
    this.status.lastCommitDate = file.lastCommitDate;

    this.status.sources = {
      impfungen: {
        url: file.download_url
      }
    };
  }

  async doUpdate() {
    const csv = await fetch(this.status.sources.impfungen.url);
    const data = csv2array(await csv.text());

    const dataCurrent = this.transformData(data);

    this.saveTable('aktuell', dataCurrent);
  }

  transformData(data: GenericObject[]) {
    // Lowercase first letter, remove all underscores but capitalize the following letter
    const transformKey = (str: string) =>
      str.charAt(0).toLowerCase() +
      str
        .replace(/_./g, (group) => group[1].toUpperCase())
        .replace('Impfort', '')
        .slice(1);

    // Convert value to number except for certain keys
    const parseIntIf = (value: string, key: string) =>
      ['Datum', 'Bundesland'].includes(key) ? value : parseInt(value, 10);

    const dataFiltered = data.filter((d) => d.Bundesland !== 'Bundesressorts');

    return dataFiltered.map((d) =>
      Object.fromEntries(
        Object.entries(d).map(([key, val]) => [
          transformKey(key),
          parseIntIf(val, key)
        ])
      )
    );
  }
}
