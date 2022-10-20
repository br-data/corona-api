require('isomorphic-fetch');
import { GenericObject, GithubFile, GithubCommit } from './types';
import { config } from './config';

// @TODO Replace with node-fetch or a similar lib
/*
export async function fetch(url: string, headers = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (response) => {
        const result: any[] = [];
        response.on('data', (data) => result.push(data));
        response.on('end', () => {
          const buffer = Buffer.concat(result);
          if (response.statusCode === 200) {
            resolve(buffer.toString());
          } else {
            console.log('url:', url);
            console.log('response:', response);
            console.log(`Buffer: "${buffer.toString()}"`);
            reject(buffer.toString());
          }
        });
        response.on('error', (e) => {
          console.log(e);
          reject(e);
        });
      })
      .on('error', (e) => {
        console.log(e);
        reject(e);
      });
  });
}
*/

// @TODO Use Github client library instead
export async function getGithubFileMeta(repo: string, filename: string) {
  if (!config.githubAccessToken) {
    throw Error('Please provide a Github access token (GITHUB_ACCESS_TOKEN)');
  }

  // Header für GitHub-API-Requests
  const gitHubAPIHeader = {headers:{
    'User-Agent': 'curl/7.64.1',
    Authorization:
      'Basic ' + Buffer.from(config.githubAccessToken).toString('base64'),
    'Content-Type': 'application/json;charset=UTF-8',
    Accept: 'application/vnd.github.+json'
  }};

  const filesRes = await fetch(
    `https://api.github.com/repos/${repo}/contents`,
    gitHubAPIHeader
  ).toString();
  const files = JSON.parse(filesRes) as GithubFile[];
  const file = files.find((file) => file.name === filename);

  if (!file) {
    throw Error(
      `Could not find "https://github.com/${repo}/blob/master/${filename}"`
    );
  }

  const commitsRes = await fetch(
    `https://api.github.com/repos/${repo}/commits?path=${filename}&per_page=1`,
    gitHubAPIHeader
  ).toString();
  const commits = JSON.parse(commitsRes) as GithubCommit[];
  file.lastCommit = commits[0];

  if (file.lastCommit) {
    file.lastCommitDate = file.lastCommit.commit.committer.date;
  }

  return file;
}

//fetch-test https://api.github.com/repos/robert-koch-institut/COVID-19-Impfungen_in_Deutschland/commits?path=Aktuell_Deutschland_Impfquoten_COVID-19.csv&per_page=1
async function test() {
  const test = await getGithubFileMeta('robert-koch-institut/COVID-19-Impfungen_in_Deutschland', 'Aktuell_Deutschland_Impfquoten_COVID-19.csv');
  console.log(test);
}
test();

// Converts a CSV into an array of objects
export function csv2array(
  text: string,
  fieldDelimiter = ',',
  lineDelimiter = '\n'
) {
  const stripBom = (str: string) =>
    str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
  const data = stripBom(text)
    .split(lineDelimiter)
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/"|'/g, '').split(fieldDelimiter));
  const keys = data.shift() as GenericObject;

  return data.map((e) =>
    Object.fromEntries(keys.map((k: string, i: number) => [k, e[i]]))
  );
}

export function sortByKeys(data: GenericObject[], keys: string[]) {
  // @ts-ignore
  data.sort((a, b) => {
    for (const key of keys) {
      if (a[key] !== b[key]) {
        return a[key] < b[key] ? -1 : 1;
      }
    }
  });

  return data;
}

// Checks, if the combination of keys is unique. Example:
// { land:'bayern', date:'2022-01-01', … }
// { land:'berlin', date:'2022-01-01', … }
// { land:'bayern', date:'2022-01-02', … }
// { land:'bayern', date:'2022-01-01', … } <--- combination of keys 'land' and 'date' is a duplicate
export function checkUniqueKeys(data: GenericObject[], keys: string[]) {
  const unique = new Set();
  for (const entry of data) {
    const key = keys.map((k) => entry[k]).join(';');
    if (unique.has(key)) {
      return false;
    }
    unique.add(key);
  }
  sortByKeys(data, keys);

  return true;
}

export function summarizer(primaryKeys: string[], numericKeys: string[]) {
  const map = new Map();

  return { add, get };

  function add(entry: GenericObject) {
    let keyString = primaryKeys.map((k) => entry[k]).join(';');
    if (!map.has(keyString)) {
      let obj = {};
      primaryKeys.forEach((k) => (obj[k] = entry[k]));
      numericKeys.forEach((k) => (obj[k] = entry[k]));
      map.set(keyString, obj);
    } else {
      let obj = map.get(keyString);
      numericKeys.forEach((k) => (obj[k] += entry[k]));
    }
  }

  function get(opt = { fillGaps: false }) {
    // @TODO Check if this was working properly before
    // if (opt.fillGaps) fillGaps(opt.fillGaps);
    if (opt.fillGaps) {
      fillGaps(primaryKeys);
    }

    const data = Array.from(map.values());
    return sortByKeys(data, primaryKeys);
  }

  // Fügt nicht vorhandene Primay-Key-Kombinationen hinzu. Beispiel:
  // {a:0,b:0,v:13},
  // {a:0,b:1,v:14},
  // {a:1,b:1,v:15},
  // {a:1,b:2,v:16}
  // Wären a und b die primaryKeys, dann wären für a die Werte [0,1] und b die Werte [0,1,2] definiert.
  // Damit wären 2*3=6 Kombinationen möglich, aber nur 4 sind angegeben.
  // Dementsprechend würde fillGaps die fehlenden Einträge hinzufügen und v als numericKey auf 0 setzen:
  // {a:0,b:2,v:0},
  // {a:1,b:0,v:0},

  function fillGaps(keys: any[]) {
    if (!Array.isArray(keys)) keys = primaryKeys;

    if (keys.length < 2) return;

    // scan keys
    keys = keys.map((key) => ({ key, values: new Set() }));

    // scan all known values for each key
    for (let entry of map.values()) {
      keys.forEach(({ key, values }) => values.add(entry[key]));
    }

    // generate all possible combinations of key values
    let combinations = [] as GenericObject[];

    keys.forEach(({ key, values }) => {
      values = Array.from(values.values()) as string[];
      values.sort((a: string, b: string) => (a < b ? -1 : 1));

      if (!combinations.length) {
        combinations = values.map((value: string) =>
          Object.fromEntries([[key, value]])
        ) as GenericObject[];
      } else {
        let newCombinations: GenericObject[] = [];
        combinations.forEach((obj) => {
          values.forEach((value: any) => {
            obj = Object.assign({}, obj);
            obj[key] = value;
            newCombinations.push(obj);
          });
        });
        combinations = newCombinations;
      }
    });

    // add zeros for all sum fields
    combinations.forEach((obj) => {
      let keyString = primaryKeys.map((k) => obj[k]).join(';');
      if (map.has(keyString)) return;
      numericKeys.forEach((k) => (obj[k] = 0));
      map.set(keyString, obj);
    });
  }
}

export function array2csv(list: GenericObject[]) {
  const keys = Object.keys(
    list.reduce((result, obj) => Object.assign(result, obj), {})
  );
  const csv = list.map((obj) =>
    keys
      .map((key) => {
        let value = obj[key];
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      })
      .join(',')
  );
  csv.unshift(keys.join(','));
  return csv.join('\n');
}
