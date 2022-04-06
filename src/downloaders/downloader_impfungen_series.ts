import { fetch, getGithubFileMeta, csv2array, summarizer } from '../lib/helper';
import { Downloader } from './downloader';
import { GenericObject } from '../lib/types';
import { config } from '../lib/config';

export class DownloaderImpfungenSerie extends Downloader {
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

    // const summaryBLFull = summarizer(
    //   ['datum', 'bundeslandId', 'impfstoff', 'impfserie'],
    //   ['anzahl']
    // );
    // const summaryDEFull = summarizer(
    //   ['datum', 'impfstoff', 'impfserie'],
    //   ['anzahl']
    // );
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

      // Only add federal states with valid IDs
      // Yes, I'm looking at you, unknown 17th state :)
      if (entry.bundeslandId <= 16) {
        // summaryBLFull.add(entry);
        // summaryDEFull.add(entry);
        summaryBLSerie.add(entry);
        summaryDESerie.add(entry);
      }
    });

    // const dataBLFull = summaryBLFull.get({ fillGaps: true });
    // const dataDEFull = summaryDEFull.get({ fillGaps: true });
    const dataBLSerie = summaryBLSerie.get({ fillGaps: true });
    const dataDESerie = summaryDESerie.get({ fillGaps: true });

    // this.addMetadata(dataBLFull, ['bundeslaender-einwohner']);
    // this.addMetadata(dataDEFull, ['deutschland-einwohner']);
    this.addMetadata(dataBLSerie, ['bundeslaender-einwohner']);
    this.addMetadata(dataDESerie, ['deutschland-einwohner']);

    const dataBLSerieSums = this.calculateSums(dataBLSerie);
    const dataDESerieSums = this.calculateSums(dataDESerie);

    const dataBLSerieTransposed = this.transposeData(dataBLSerieSums);
    const dataDESerieTransposed = this.transposeData(dataDESerieSums);

    // this.saveTable('bl-full', dataBLFull);
    // this.saveTable('de-full', dataDEFull);
    this.saveTable('bl', dataBLSerieTransposed);
    this.saveTable('de', dataDESerieTransposed);
  }

  transposeData(data: GenericObject[]) {
    const suffixe = [
      'KeineImpfung',
      'Erstimpfung',
      'Zweitimpfung',
      'Drittimpfung',
      'Viertimpfung'
    ];
    const uniqueDates = [...new Set(data.map((d) => d.datum))];
    const uniqueStates = [...new Set(data.map((d) => d.bundesland))];

    return uniqueDates
      .map((date) =>
        uniqueStates.map((state) => {
          const currentGroup = data.filter(
            (d) => d.datum === date && d.bundesland === state
          );

          const { impfserie, anzahl, summe, ...currentMetaData } =
            currentGroup[0];

          return currentGroup.reduce((result, entry) => {
            const currentSuffix = suffixe[entry.impfserie];
            const rate = Math.round((entry.summe / entry.einwohnerzahl) * 1000) / 10;

            result[`anzahl${currentSuffix}`] = entry.anzahl;
            result[`summe${currentSuffix}`] = entry.summe;
            result[`quote${currentSuffix}`] = rate;

            return result;
          }, currentMetaData);
        })
      )
      .flat();
  }

  calculateSums(data: GenericObject[]) {
    const uniqueSeries = [...new Set(data.map((d) => d.impfserie))];
    const uniqueStates = [...new Set(data.map((d) => d.bundesland))];

    return uniqueSeries
      .map((series) =>
        uniqueStates.map((state) => {
          const currentGroup = data.filter(
            (d) => d.impfserie === series && d.bundesland === state
          );

          return currentGroup.reduce((result, entry) => {
            const summe = result.length
              ? result[result.length - 1].summe + entry.anzahl
              : entry.anzahl;

            return result.concat([{ ...entry, summe }]);
          }, []);
        })
      )
      .flat(2);
  }
}
