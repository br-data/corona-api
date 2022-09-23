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
  githubFile = 'Aktuell_Deutschland_adjustierte-COVID-19-Hospitalisierungen.csv';

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
        hospitalisierung7TOhneNachmeldungFaelle: parseInt(e['fixierte_7T_Hospitalisierung_Faelle'], 10),
        hospitalisierung7TMitNachmeldungFaelle: parseInt(e['aktualisierte_7T_Hospitalisierung_Faelle'], 10),
        hospitalisierung7TSchaetzungFaelle: parseInt(e['PS_adjustierte_7T_Hospitalisierung_Faelle'], 10),
        hospitalisierung7TObereSchaetzungFaelle: parseInt(e['OG_PI_adjustierte_7T_Hospitalisierung_Faelle'], 10),
        hospitalisierung7TUntereSchaetzungFaelle: parseInt(e['UG_PI_adjustierte_7T_Hospitalisierung_Faelle'], 10),
        hospitalisierung7TOhneNachmeldungInzidenz: parseFloat(e['fixierte_7T_Hospitalisierung_Inzidenz']),
        hospitalisierung7TMitNachmeldungInzidenz: parseFloat(e['aktualisierte_7T_Hospitalisierung_Inzidenz']),
        hospitalisierung7TSchaetzungInzidenz: parseFloat(e['PS_adjustierte_7T_Hospitalisierung_Inzidenz']),
        hospitalisierung7TObereSchaetzungFaelleInzidenz: parseFloat(e['OG_PI_adjustierte_7T_Hospitalisierung_Inzidenz']),
        hospitalisierung7TUntereSchaetzungInzidenz: parseFloat(e['UG_PI_adjustierte_7T_Hospitalisierung_Inzidenz'])
      };
      if (entry.bundeslandId > 0 && entry.altersgruppe === 'alle')
        dataBL.push(entry);
      if (entry.bundeslandId === 0 && entry.altersgruppe === 'alle')
        dataDE.push(entry);
    });

    if (!checkUniqueKeys(dataBL, ['datum', 'bundeslandId'])) throw Error();
    if (!checkUniqueKeys(dataDE, ['datum'])) throw Error();

    this.addMetadata(dataBL, ['bundeslaender']);
    this.addMetadata(dataDE, ['deutschland-einwohner']);

    this.saveTable('bl', dataBL);
    this.saveTable('de', dataDE);
    
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
