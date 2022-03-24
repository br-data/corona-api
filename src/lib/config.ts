import fs from 'fs';
import { resolve } from 'path';

export const config = {
  folders: {
    data: resolve(__dirname, '../../data'),
    status: resolve(__dirname, '../../data/status'),
    log: resolve(__dirname, '../../data/log'),
    tables: resolve(__dirname, '../../data/tables'),
    static: resolve(__dirname, '../../static'),
    cache: resolve(__dirname, '../../data/cache')
  },
  
  // generate one at: https://github.com/settings/tokens/new
  githubAccessToken: process.env.GITHUB_ACCESS_TOKEN,

  updateEvery: 10 * 60 * 1000,

  // Die Versionsnummer wird den Datei-Hashes angefügt.
  // Wenn man sie erhöht, erzwingt man einen Datenupdate.
  version: '2.0.0'
};

// @TODO Move this to a preparation script
for (let folder of Object.values(config.folders))
  fs.mkdirSync(folder, { recursive: true });
