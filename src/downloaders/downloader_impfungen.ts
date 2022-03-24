import { fetch, getGithubFileMeta, csv2array, summarizer } from '../lib/helper';
import { Downloader } from './downloader';
import { config } from '../lib/config';

export class DownloaderImpfungen extends Downloader {
  githubRepo = 'robert-koch-institut/COVID-19-Impfungen_in_Deutschland';
  githubFile = 'Aktuell_Deutschland_Bundeslaender_COVID-19-Impfungen.csv';

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
    const data = csv2array(csv.toString());

    const summaryBLFull = summarizer(
      ['datum', 'bundeslandId', 'impfstoff', 'impfserie'],
      ['anzahl']
    );
    const summaryDEFull = summarizer(
      ['datum', 'impfstoff', 'impfserie'],
      ['anzahl']
    );
    const summaryBLSerie = summarizer(
      ['datum', 'bundeslandId', 'impfserie'],
      ['anzahl']
    );
    const summaryDESerie = summarizer(['datum', 'impfserie'], ['anzahl']);

    data.forEach((e) => {
      const entry = {
        datum: e.Impfdatum,
        bundeslandId: parseInt(e.BundeslandId_Impfort, 10),
        impfstoff: e.Impfstoff,
        impfserie: parseInt(e.Impfserie, 10),
        anzahl: parseInt(e.Anzahl, 10)
      };
      summaryBLFull.add(entry);
      summaryDEFull.add(entry);
      summaryBLSerie.add(entry);
      summaryDESerie.add(entry);
    });

    const dataBLFull = summaryBLFull.get({ fillGaps: true });
    const dataDEFull = summaryDEFull.get({ fillGaps: true });
    const dataBLSerie = summaryBLSerie.get({ fillGaps: true });
    const dataDESerie = summaryDESerie.get({ fillGaps: true });

    this.addMetadata(dataBLFull, ['bundeslaender-einwohner']);
    this.addMetadata(dataDEFull, ['deutschland-einwohner']);
    this.addMetadata(dataBLSerie, ['bundeslaender-einwohner']);
    this.addMetadata(dataDESerie, ['deutschland-einwohner']);

    this.saveTable('bl-full', dataBLFull);
    this.saveTable('de-full', dataDEFull);
    this.saveTable('bl-serie', dataBLSerie);
    this.saveTable('de-serie', dataDESerie);
  }
}
