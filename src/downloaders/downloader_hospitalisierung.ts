import { Downloader } from './downloader';
import {
  fetch,
  getGithubFileMeta,
  csv2array,
  checkUniqueKeys
} from '../lib/helper';
import { GenericObject } from '../lib/types';
import { config } from '../lib/config';

export class DownloaderHospitalisierungen extends Downloader {
  githubRepo =
    'robert-koch-institut/COVID-19-Hospitalisierungen_in_Deutschland';
  githubFile = 'Aktuell_Deutschland_COVID-19-Hospitalisierungen.csv';

  constructor() {
    super('hospitalisierung');
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
      hospitalisierung: {
        url: file.download_url
      }
    };
  }

  async doUpdate() {
    const csv = await fetch(this.status.sources.hospitalisierung.url);
    const data = csv2array(csv.toString());

    const dataBL: GenericObject[] = [];
    const dataDE: GenericObject[] = [];
    const dataDEAlt: GenericObject[] = [];

    data.forEach((e) => {
      const entry = {
        datum: e.Datum,
        bundeslandId: parseInt(e.Bundesland_Id, 10),
        altersgruppe: cleanAltersgruppe(e.Altersgruppe),
        hospitalisierung7TFaelle: parseInt(e['7T_Hospitalisierung_Faelle'], 10),
        hospitalisierung7TInzidenz: parseFloat(
          e['7T_Hospitalisierung_Inzidenz']
        )
      };
      if (entry.bundeslandId > 0 && entry.altersgruppe === 'alle')
        dataBL.push(entry);
      if (entry.bundeslandId === 0 && entry.altersgruppe === 'alle')
        dataDE.push(entry);
      if (entry.bundeslandId === 0 && entry.altersgruppe !== 'alle')
        dataDEAlt.push(entry);
    });

    if (!checkUniqueKeys(dataBL, ['datum', 'bundeslandId'])) throw Error();
    if (!checkUniqueKeys(dataDE, ['datum'])) throw Error();
    if (!checkUniqueKeys(dataDEAlt, ['datum', 'altersgruppe'])) throw Error();

    this.addMetadata(dataBL, ['bundeslaender']);
    this.addMetadata(dataDE, ['deutschland-einwohner']);
    this.addMetadata(dataDEAlt, ['deutschland-alter']);

    this.saveTable('bl', dataBL);
    this.saveTable('de', dataDE);
    this.saveTable('de-alt', dataDEAlt);

    function cleanAltersgruppe(text: string) {
      switch (text) {
        case '00+':
          return 'alle';
        case '00-04':
          return '0-4';
        case '05-14':
          return '5-14';
        case '15-34':
        case '35-59':
        case '60-79':
        case '80+':
          return text;
      }
      throw Error('unbekannte Altersgruppe "' + text + '"');
    }
  }
}
