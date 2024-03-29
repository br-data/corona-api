import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { config } from './config';
import { array2csv } from './helper';
import { update as updateDownloader } from '../download';
import { GenericObject } from './types';

// @TODO Convert function to class syntax
export function Database() {
  const tableLookup = new Map();

  return {
    start,
    queryData,
    getTables,
    getFields
  };

  // Initialisiere die Daten und richte ein regelmäßigen Datenupdate ein.
  async function start() {
    await updateData();
    setInterval(updateData, config.updateEvery);
  }

  // Stelle sicher, dass die Daten vorhanden sind.
  async function updateData() {
    await updateDownloader();

    // Lade die Daten
    const folder = config.folders.tables;
    readdirSync(folder).forEach((filename) => {
      if (!filename.endsWith('.json')) return;

      const tableName = filename.replace(/\..*/, '');
      const fullname = resolve(folder, filename);
      const mtime = statSync(fullname).mtime;

      if (!tableLookup.has(tableName)) {
        tableLookup.set(tableName, { name: tableName });
      }

      const table = tableLookup.get(tableName);

      if (table.mtime !== mtime) {
        try {
          const result = JSON.parse(readFileSync(fullname).toString());
          table.date = result.date;
          table.data = result.data;
          table.mtime = mtime;
        } catch (e: any) {
          console.log(e.toString());
        }
      }
    });
  }

  function queryData(tableName: string, query: GenericObject) {
    const table = tableLookup.get(tableName);
    if (!table)
      throw Error(
        `unknown table "${tableName}". known tables: ` +
          Array.from(tableLookup.keys()).join(',')
      );

    let data = table.data.slice();

    // Filter
    if (query.filter) {
      let filters = query.filter;
      if (!Array.isArray(filters)) filters = [filters];

      for (const filter of filters) {
        let regular_expression = getRegExp(filter);
        const match = filter.match(regular_expression);
        if (!match)
          throw Error(
            `malformed filter ${filter}: expecting e.g. "filter=bundeslandId==12"`
          );
        const key = match[1];
        const compare = match[2];
        let value = match.slice(3, match.length);
        value = checkDataType(value);

        let filterFunction;
        switch (compare) {
          case '==':
            filterFunction = (obj: GenericObject) => value.includes(obj[key])
            break;
          case '!=':
            filterFunction = (obj: GenericObject) => !value.includes(obj[key])
            break;
          case '<=':
            filterFunction = (obj: GenericObject) => obj[key] <= value;
            break;
          case '>=':
            filterFunction = (obj: GenericObject) => obj[key] >= value;
            break;
          case '<':
            filterFunction = (obj: GenericObject) => obj[key] < value;
            break;
          case '>':
            filterFunction = (obj: GenericObject) => obj[key] > value;
            break;
          default:
            throw Error(`unknown comparison "${compare}"`);
        }

        data = data.filter(filterFunction);
      }
    }

    // sort
    if (query.sort) {
      let sorters = query.sort;
      if (!Array.isArray(sorters)) sorters = [sorters];
      sorters.reverse();

      for (const sorter of sorters) {
        const match = sorter.match(/^([\w-]+)(=desc)?$/i);
        if (!match)
          throw Error(
            `malformed sort ${sorter}: expecting e.g. "sort=bundesland" or "sort=datum=desc"`
          );
        const key = match[1];
        const ascending = !match[2];
        if (ascending) {
          data.sort((a: string, b: string) => (a[key] < b[key] ? -1 : 1));
        } else {
          data.sort((a: string, b: string) => (a[key] < b[key] ? 1 : -1));
        }
      }
    }

    if (query.fieldList) {
      const fields = query.fieldList.split(',');
      data = data.map((entry: GenericObject) =>
        Object.fromEntries(fields.map((field: string) => [field, entry[field]]))
      );
    }

    // limit
    if (query.limit) {
      const limit = parseInt(query.limit, 10);
      data = data.slice(0, limit);
    }

    // format
    switch (query.format) {
      case 'json':
        return {
          mime: 'application/json',
          body: JSON.stringify(data)
        };
      case undefined:
      case 'csv':
        return {
          mime: 'text/plain',
          body: array2csv(data)
        };
      default:
        throw Error(`unknown format "${query.format}"`);
    }
  }

  // Gebe eine Liste aller Tabellen zurück
  function getTables() {
    let tables = Array.from(tableLookup.values());
    tables = tables.map((t) => ({ name: t.name, date: t.date }));
    tables.sort((a, b) => (a.name < b.name ? -1 : 1));
    return tables;
  }

  // Gebe eine Liste aller Felder einer Tabelle zurück
  function getFields(tableName: string) {
    const table = tableLookup.get(tableName);
    if (!table)
      throw Error(
        `unknown table "${tableName}". known tables: ` +
          Array.from(tableLookup.keys()).join(',')
      );
    return Object.keys(table.data[0]);
  }

  // Bilde die Regular Expression fuer die passende Anzahl an durch Kommata getrennte Elemente 
  function getRegExp(new_query: string) {
    const count_occurences = (str: string) => {
        const re = new RegExp(',[\\w-]', 'g')
        return ((str || '').match(re) || []).length
    }

    const pattern = ',([\\w-]+)';
    const repeated_string = pattern.repeat(count_occurences(new_query));

    const regex = '([\\w-]+)([\\<\\>]=?|[\\=\\!]=)([\\w-]+)';
    const complete_regex = regex.concat(repeated_string);
    const final_regex = new RegExp(complete_regex);

    return final_regex;
};

// Checke ob alle eingegebenen Werte Integer sind und wandele um wenn ja
function checkDataType(numbers_to_check: string[]){

  let true_array = Array();

  numbers_to_check.forEach(function(item){

      let true_or_not = /^[0-9]+$/.test(item);
      true_array.push(true_or_not);    
  });

  let new_numbers;

  if (true_array.every(v => v === true)) {
      new_numbers = numbers_to_check.map(x => parseInt(x, 10));
  } else {
      new_numbers = numbers_to_check.slice();
  }

  return new_numbers;

};
}
