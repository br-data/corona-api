import {
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  existsSync
} from 'fs';
import { resolve } from 'path';
import { config } from '../lib/config';
import { GenericObject } from '../lib/types';
import deutschland from '../../static/deutschland-einwohner.json';
import deutschland_alter from '../../static/deutschland-alter.json';
import bundeslaender from '../../static/bundeslaender.json';
import bundeslaender_einwohner from '../../static/bundeslaender-einwohner.json';
import bundeslaender_alter from '../../static/deutschland-alter.json';
import landkreise_einwohner from '../../static/landkreise-einwohner.json';
import landkreis2regierungsbezirk from '../../static/regierungsbezirke.json';
import landkreise from '../../static/landkreise.json';
import { type } from 'os';


export class Downloader {
  name: string;
  statusFilename: string;
  status: {
    name: string;
    sources: GenericObject;
    dateStart?: number;
    dateEnd?: number;
    lastDate?: string;
    lastCommitDate?: string;
    hash?: string;
    newHash?: string;
    changed?: boolean;
    error?: string | undefined;
  };

  constructor(name: string) {
    this.name = name;
    this.statusFilename = resolve(config.folders.status, this.name + '.json');
  }

  async run() {
    // Lade den letzten Status
    this.loadStatus();
    this.status.error = undefined;

    try {
      console.log('   check for updates');
      // @ts-ignore @TODO Add proper definition
      await this.checkUpdates();

      if (this.status.changed) {
        // new data
        console.log('   update started');
        // @ts-ignore @TODO Add proper definition
        await this.doUpdate();
        console.log('   update finished');
      } else {
        // no new data
        console.log('   no updates');
      }

      this.status.hash = this.status.newHash;
    } catch (e: any) {
      // error handling
      this.status.error = e.toString();
      console.log(e);
    }

    // Speichere den aktuellen Status
    this.saveStatus();
  }

  // Lade das letzte Status-Objekt, bzw. erstelle ein neues Status-Objekt
  async loadStatus() {
    try {
      this.status = await import(this.statusFilename);
    } catch (err) {
      throw err;
    } 
    //if (existsSync(this.statusFilename)) {
      //let test_name = this.statusFilename;
      //this.status = await import(test_name);
      //this.status = JSON.parse(readFileSync(this.statusFilename).toString());
    //} else {
      // @ts-ignore @TODO Add proper definition
      //this.status = {};
    //}
    this.status.dateStart = Date.now();
  }

  // Speicher das Status-Objekt
  saveStatus() {
    this.status.name = this.name;
    this.status.dateEnd = Date.now();

    const file = JSON.stringify(this.status);
    const timestamp = new Date().toISOString().slice(0, 23).replace(/\D/g, '-');
    const logFilename = resolve(
      config.folders.log,
      `${timestamp}-${this.name}.json`
    );

    writeFileSync(this.statusFilename, file);
    writeFileSync(logFilename, file);
  }

  // Speichere die Daten-Tabelle
  saveTable(slug: string, data: GenericObject[]) {
    const filename = resolve(
      config.folders.tables,
      `${this.name}-${slug}.json`
    );
    const dataString =
      '[\n\t' + data.map((e) => JSON.stringify(e)).join(',\n\t') + '\n]';
    const dataStringWithDate = `{"date":${Date.now()},"data":${dataString}}`;
    writeFileSync(filename, dataStringWithDate);
  }

  addMetadata(data: GenericObject[], fields: string[]) {
    const dataFolder = config.folders.static;

    fields.forEach((field) => {
      const cacheAltergruppen = new Map();

      switch (field) {
        
        case 'deutschland-einwohner':
          
          {/**
            const deutschland = JSON.parse(
              readFileSync(
                resolve(dataFolder, 'deutschland-einwohner.json')
              ).toString()
            );
            */
            data.forEach((e) => Object.assign(e, deutschland));
          }
          break;

        case 'deutschland-alter':
          {
            /**const deutschland = JSON.parse(
              readFileSync(
                resolve(dataFolder, 'deutschland-alter.json')
              ).toString()
            );
            */
            data.forEach((e) => {
              e.einwohnerzahl = getAltersgruppen(
                e.altersgruppe,
                e.altersgruppe,
                deutschland_alter.einwohnerzahl
              );
            });
          }
          break;

        case 'bundeslaender':
          {/**
            const bundeslaender = JSON.parse(
              readFileSync(resolve(dataFolder, 'bundeslaender.json')).toString()
            );
             */
            data.forEach((e) =>
              Object.assign(e, bundeslaender[e.bundeslandId])
            );
          }
          break;

        case 'bundeslaender-einwohner':
          {/**
            const bundeslaender = JSON.parse(
              readFileSync(
                resolve(dataFolder, 'bundeslaender-einwohner.json')
              ).toString()
            );
            */
            data.forEach((e) =>
              Object.assign(e, bundeslaender_einwohner[e.bundeslandId])
            );
          }
          break;

        case 'bundeslaender-alter':
          {/** 
            const bundeslaender = JSON.parse(
              readFileSync(
                resolve(dataFolder, 'bundeslaender-alter.json')
              ).toString()
            );*/
            data.forEach((e) => {
              const obj = Object.assign({}, bundeslaender_alter[e.bundeslandId]);
              obj.einwohnerzahl = getAltersgruppen(
                e.bundeslandId + '_' + e.altersgruppe,
                e.altersgruppe,
                obj.einwohnerzahl
              );
              Object.assign(e, obj);
            });
          }
          break;

        case 'regierungsbezirke-einwohner':
          { /**
            const landkreise = JSON.parse(
              readFileSync(
                resolve(dataFolder, 'landkreise-einwohner.json')
              ).toString()
            );
            const landkreis2regierungsbezirk = JSON.parse(
              readFileSync(
                resolve(dataFolder, 'regierungsbezirke.json')
              ).toString()
            );
             */
            const regierungsbezirke = new Map();
            Object.entries(landkreis2regierungsbezirk).forEach(
              ([landkreisId, regierungsbezirk]) => {
                if (!regierungsbezirke.has(regierungsbezirk))
                  regierungsbezirke.set(regierungsbezirk, { einwohnerzahl: 0 });
                regierungsbezirke.get(regierungsbezirk).einwohnerzahl +=
                  landkreise_einwohner[landkreisId].einwohnerzahl;
              }
            );
            data.forEach((e) =>
              Object.assign(e, regierungsbezirke.get(e.regierungsbezirk))
            );
          }
          break;

        case 'landkreise':
          { /**
            const landkreise = JSON.parse(
              readFileSync(resolve(dataFolder, 'landkreise.json')).toString()
            );
             */
            data.forEach((e) => Object.assign(e, landkreise[e.landkreisId]));
          }
          break;

        case 'landkreise-einwohner':
          { /** 
            const landkreise = JSON.parse(
              readFileSync(
                resolve(dataFolder, 'landkreise-einwohner.json')
              ).toString()
            );
            */
            data.forEach((e) => Object.assign(e, landkreise_einwohner[e.landkreisId]));
          }
          break;

        default:
          throw Error('unknown metadata type: ' + field);
      }

      function getAltersgruppen(
        key: string,
        gruppe: string,
        einwohnerzahl: any[]
      ) {
        if (gruppe === 'unbekannt') return 0;

        if (cacheAltergruppen.has(key)) return cacheAltergruppen.get(key);

        let match,
          i0 = 0,
          i1 = einwohnerzahl.length - 1;
        if ((match = gruppe.match(/^(\d+)-(\d+)$/))) {
          i0 = parseInt(match[1], 10);
          i1 = parseInt(match[2], 10);
        } else if ((match = gruppe.match(/^(\d+)\+$/))) {
          i0 = parseInt(match[1], 10);
        } else {
          throw Error(`unknown altersgruppe "${gruppe}"`);
        }

        let sum = 0;
        for (let i = i0; i <= i1; i++) sum += einwohnerzahl[i];
        cacheAltergruppen.set(key, sum);

        return key;
      }
    });
  }

  getLogs() {
    // behalte nur Logdateien, die nicht älter als 1 Woche sind
    const minTime = Date.now() - 7 * 86400000;

    // Lade Log-Dateien
    const logs: GenericObject[] = [];
    readdirSync(config.folders.log).forEach((f) => {
      if (!f.endsWith(this.name + '.json')) return;
      const filename = resolve(config.folders.log, f);
      try {
        const status = JSON.parse(readFileSync(filename).toString());

        if (status.dateStart < minTime) return rmSync(filename);

        logs.push(status);
      } catch (e) {}
    });

    logs.sort((a, b) => a.dateStart - b.dateStart);

    return logs;
  }
}
