import fs from 'fs';
import { resolve } from 'path';
import { Downloader } from './downloader';
import { getGithubFileMeta, csv2array, summarizer } from '../lib/helper';
require('isomorphic-fetch');
import { GenericObject } from '../lib/types';
import { config } from '../lib/config';

export class DownloaderInfektionen extends Downloader {
  githubRepo = 'robert-koch-institut/SARS-CoV-2-Infektionen_in_Deutschland';
  githubFile = 'Aktuell_Deutschland_SarsCov2_Infektionen.csv';

  constructor() {
    super('infektionen');
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
      infektionen: {
        url: `https://media.githubusercontent.com/media/${this.githubRepo}/main/${this.githubFile}` // Git LFS
      }
    };
  }

  async doUpdate() {
    console.log('      download');

    const csv = await fetch(this.status.sources.infektionen.url);

    console.log('      process');

    const data = csv2array(csv.toString(), ',', '\r\n');

    const summaryLK = summarizer(
      ['meldedatum', 'bundeslandId', 'landkreisId'],
      ['anzahlFall', 'anzahlTodesfall', 'anzahlGenesen']
    );
    const summaryRB = summarizer(
      ['meldedatum', 'bundeslandId', 'regierungsbezirk'],
      ['anzahlFall', 'anzahlTodesfall', 'anzahlGenesen']
    );
    const summaryBL = summarizer(
      ['meldedatum', 'bundeslandId'],
      ['anzahlFall', 'anzahlTodesfall', 'anzahlGenesen']
    );
    const summaryDE = summarizer(
      ['meldedatum'],
      ['anzahlFall', 'anzahlTodesfall', 'anzahlGenesen']
    );
    const summaryLKNeu = summarizer(
      ['bundeslandId', 'landkreisId'],
      ['anzahlFallNeu', 'anzahlTodesfallNeu', 'anzahlGenesenNeu']
    );
    const summaryRBNeu = summarizer(
      ['bundeslandId', 'regierungsbezirk'],
      ['anzahlFallNeu', 'anzahlTodesfallNeu', 'anzahlGenesenNeu']
    );
    const summaryBLNeu = summarizer(
      ['bundeslandId'],
      ['anzahlFallNeu', 'anzahlTodesfallNeu', 'anzahlGenesenNeu']
    );
    const summaryDENeu = summarizer(
      [],
      ['anzahlFallNeu', 'anzahlTodesfallNeu', 'anzahlGenesenNeu']
    );
    const summaryBLAlt = summarizer(
      ['meldedatum', 'bundeslandId', 'altersgruppe'],
      ['anzahlFall', 'anzahlTodesfall', 'anzahlGenesen']
    );
    const summaryDEAlt = summarizer(
      ['meldedatum', 'altersgruppe'],
      ['anzahlFall', 'anzahlTodesfall', 'anzahlGenesen']
    );

    const regierungsbezirke = JSON.parse(
      fs
        .readFileSync(resolve(config.folders.static, 'regierungsbezirke.json'))
        .toString()
    );

    let dateMin = '2020-01-01';
    let dateMax = '2020-01-01'; // @TODO Is this correct?

    data.forEach((e) => {
      const landkreisId = parseInt(e.IdLandkreis, 10);
      const anzahlFall = parseInt(e.AnzahlFall, 10);
      const anzahlTodesfall = parseInt(e.AnzahlTodesfall, 10);
      const anzahlGenesen = parseInt(e.AnzahlGenesen, 10);
      const neuerFall = parseInt(e.NeuerFall, 10);
      const neuerTodesfall = parseInt(e.NeuerTodesfall, 10);
      const neuGenesen = parseInt(e.NeuGenesen, 10);

      if (!e.IdLandkreis) {
        console.log(e);
      }

      const entry = {
        landkreisId: landkreisId,
        bundeslandId: parseInt(e.IdLandkreis.slice(0, -3), 10),
        regierungsbezirk: regierungsbezirke[landkreisId],
        altersgruppe: cleanAltersgruppe(e.Altersgruppe),
        //geschlecht: e.Geschlecht.toLowerCase(),
        meldedatum: e.Meldedatum,
        //refdatum: e.Refdatum,
        //istErkrankungsbeginn: parseInt(e.IstErkrankungsbeginn, 10),
        anzahlFall: neuerFall === 0 || neuerFall === 1 ? anzahlFall : 0,
        anzahlTodesfall:
          neuerTodesfall === 0 || neuerTodesfall === 1 ? anzahlTodesfall : 0,
        anzahlGenesen: neuGenesen === 0 || neuGenesen === 1 ? anzahlGenesen : 0,
        anzahlFallNeu: neuerFall === -1 || neuerFall === 1 ? anzahlFall : 0,
        anzahlTodesfallNeu:
          neuerTodesfall === -1 || neuerTodesfall === 1 ? anzahlTodesfall : 0,
        anzahlGenesenNeu:
          neuGenesen === -1 || neuGenesen === 1 ? anzahlGenesen : 0
      };
      if (dateMin > entry.meldedatum) dateMin = entry.meldedatum;
      if (dateMax < entry.meldedatum) dateMax = entry.meldedatum;

      // fasse Berlin zusammen
      if (entry.landkreisId >= 11001 && entry.landkreisId <= 11012)
        entry.landkreisId = 11000;

      summaryLK.add(entry);
      if (entry.regierungsbezirk) summaryRB.add(entry);
      summaryBL.add(entry);
      summaryDE.add(entry);

      summaryLKNeu.add(entry);
      if (entry.regierungsbezirk) summaryRBNeu.add(entry);
      summaryBLNeu.add(entry);
      summaryDENeu.add(entry);

      summaryBLAlt.add(entry);
      summaryDEAlt.add(entry);
    });

    console.log('      finalize');

    let dataLK = summaryLK.get();
    let dataRB = summaryRB.get();
    let dataBL = summaryBL.get({ fillGaps: true });
    let dataDE = summaryDE.get({ fillGaps: true });
    let dataLKNeu = summaryLKNeu.get();
    let dataRBNeu = summaryRBNeu.get();
    let dataBLNeu = summaryBLNeu.get();
    let dataDENeu = summaryDENeu.get();
    let dataBLAlt = summaryBLAlt.get({ fillGaps: true });
    let dataDEAlt = summaryDEAlt.get({ fillGaps: true });

    console.log('      add meta data');

    this.addMetadata(dataLK, ['bundeslaender', 'landkreise-einwohner']);
    this.addMetadata(dataRB, ['bundeslaender', 'regierungsbezirke-einwohner']);
    this.addMetadata(dataBL, ['bundeslaender-einwohner']);
    this.addMetadata(dataDE, ['deutschland-einwohner']);
    this.addMetadata(dataLKNeu, ['bundeslaender', 'landkreise-einwohner']);
    this.addMetadata(dataRBNeu, [
      'bundeslaender',
      'regierungsbezirke-einwohner'
    ]);
    this.addMetadata(dataBLNeu, ['bundeslaender']);
    this.addMetadata(dataDENeu, []);
    this.addMetadata(dataBLAlt, ['bundeslaender-alter']);
    this.addMetadata(dataDEAlt, ['deutschland-alter']);

    console.log('      calculate incidences');

    dataLK = calcInzidenzenUndSummen(dataLK, ['landkreisId']);
    dataRB = calcInzidenzenUndSummen(dataRB, ['regierungsbezirk']);
    dataBL = calcInzidenzenUndSummen(dataBL, ['bundeslandId']);
    dataDE = calcInzidenzenUndSummen(dataDE);
    dataBLAlt = calcInzidenzenUndSummen(dataBLAlt, [
      'altersgruppe',
      'bundeslandId'
    ]);
    dataDEAlt = calcInzidenzenUndSummen(dataDEAlt, ['altersgruppe']);
    addLatestMeldedatum(dataLKNeu);
    addLatestMeldedatum(dataRBNeu);
    addLatestMeldedatum(dataBLNeu);
    addLatestMeldedatum(dataDENeu);

    console.log('      save');

    this.saveTable('lk', dataLK);
    this.saveTable('rb', dataRB);
    this.saveTable('bl', dataBL);
    this.saveTable('de', dataDE);
    this.saveTable('lk-aktuell', dataLKNeu);
    this.saveTable('rb-aktuell', dataRBNeu);
    this.saveTable('bl-aktuell', dataBLNeu);
    this.saveTable('de-aktuell', dataDENeu);
    this.saveTable('bl-alter', dataBLAlt);
    this.saveTable('de-alter', dataDEAlt);

    function cleanAltersgruppe(text: string) {
      switch (text) {
        case 'unbekannt':
          return 'unbekannt';
        case 'A00-A04':
          return '0-4';
        case 'A05-A14':
          return '5-14';
        case 'A15-A34':
          return '15-34';
        case 'A35-A59':
          return '35-59';
        case 'A60-A79':
          return '60-79';
        case 'A80+':
          return '80+';
      }
      throw Error('unbekannte Altersgruppe "' + text + '"');
    }

    function addLatestMeldedatum(list: GenericObject[]) {
      list.forEach((e) => (e.meldedatum = dateMax));
    }

    function calcInzidenzenUndSummen(
      data: GenericObject[],
      groupKeys: string[] = []
    ) {
      const groups = new Map();
      data.forEach((entry) => {
        const key = groupKeys.map((k) => entry[k]).join('_');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
      });

      const result: GenericObject[] = [];
      Array.from(groups.values()).forEach((list) => {
        // Vervollständige die Daten.
        // Tage ohne Eintrag werden hinzugefügt, wobei die Werte alle Null sind.
        const dateLookup = new Map(
          list.map((e: GenericObject) => [e.meldedatum, e])
        );
        const obj0 = list[0];
        forEachDate(dateMin, dateMax, (date: string) => {
          if (dateLookup.has(date)) return;
          let obj = Object.assign({}, obj0);
          obj.meldedatum = date;
          obj.anzahlFall = 0;
          obj.anzahlTodesfall = 0;
          obj.anzahlGenesen = 0;
          list.push(obj);
        });

        list.sort((a: GenericObject, b: GenericObject) =>
          a.meldedatum < b.meldedatum ? -1 : 1
        );

        // Berechne Inzidenzen
        for (let i = 0; i < list.length; i++) {
          let entry0 = list[i];
          let minDatum = new Date(
            Date.parse(entry0.meldedatum) - 6.1 * 84600000
          )
            .toISOString()
            .slice(0, 10);
          let j0 = Math.max(0, i - 6);
          let sum = 0;
          let count = 0;

          for (let j = j0; j <= i; j++) {
            let entry1 = list[j];
            if (entry1.meldedatum < minDatum) continue;
            sum += entry1.anzahlFall;
            count++;
          }
          entry0.mittlere7TageInfektionen = Math.round((10 * sum) / 7) / 10;
          entry0.inzidenz = Math.round((1e6 * sum) / entry0.einwohnerzahl) / 10;
        }

        // Berechne aggregierte Faelle
        for (let i = 0; i < list.length; i++) {
          let entry = list[i];
          entry.summeFall = entry.anzahlFall;
          entry.summeTodesfall = entry.anzahlTodesfall;
          entry.summeGenesen = entry.anzahlGenesen;

          if (i === 0) continue;

          entry.summeFall += list[i - 1].summeFall;
          entry.summeTodesfall += list[i - 1].summeTodesfall;
          entry.summeGenesen += list[i - 1].summeGenesen;
        }

        // Berechne aktive Fälle und Genesene (Copyright: Niels-Magie)
        list.map((d: GenericObject, i: number) => {
          d.aktuellGenesen =
            i < 14 ? 0 : list[i - 14].summeFall - d.summeTodesfall;
          d.aktuellInfiziert =
            d.summeFall - d.aktuellGenesen - d.summeTodesfall;
        });

        list.map((d: GenericObject, i: number) => {
          const schwereFaelle = Math.floor(d.aktuellGenesen * 0.2);
          d.aktuellGenesen -= schwereFaelle;
          d.aktuellInfiziert += schwereFaelle;

          for (let ii = 0; ii < schwereFaelle; ii++) {
            const delay = Math.floor(Math.random() * 28) + 1;
            if (i + delay < list.length) {
              list[i + delay].aktuellGenesen += 1;
              list[i + delay].aktuellInfiziert -= 1;
            }
          }
        });

        // Füge das Ergebnis hinzu
        result.push(list);
      });

      return result.flat();
    }

    function forEachDate(
      dateMin: string,
      dateMax: string,
      callback: (arg0: string) => void
    ) {
      let d0 = Math.floor(Date.parse(dateMin) / 86400000 + 0.5);
      let d1 = Math.floor(Date.parse(dateMax) / 86400000 + 0.5);
      for (let d = d0; d <= d1; d++) {
        callback(new Date((d + 0.5) * 86400000).toISOString().slice(0, 10));
      }
    }
  }
}
