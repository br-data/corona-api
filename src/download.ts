import { DownloaderHospitalisierungen } from './downloaders/downloader_hospitalisierung';
import { DownloaderImpfungenAktuell } from './downloaders/downloader_impfungen_aktuell';
import { DownloaderImpfungenSerie } from './downloaders/downloader_impfungen_series';
import { DownloaderInfektionen } from './downloaders/downloader_infektionen';
import { DownloaderIntensivpatienten } from './downloaders/downloader_intensivpatienten';

const workers = [
  {
    name: 'hospitalisierungen',
    Downloader: DownloaderHospitalisierungen
  },
  {
    name: 'impfungen',
    Downloader: DownloaderImpfungenAktuell
  },
  {
    name: 'impfungen',
    Downloader: DownloaderImpfungenSerie
  },
  {
    name: 'intensivpatienten',
    Downloader: DownloaderIntensivpatienten
  },
  {
    name: 'infektionen',
    Downloader: DownloaderInfektionen
  }
];

// @TODO Move this to a preparation script
// if (require.main === module) update();

export async function update() {
  console.log('downloaders started');

  for (let worker of workers) {
    const { name, Downloader } = worker;
    console.log(`downloader ${name} started`);
    await new Downloader().run();
    console.log(`downloader ${name} finished`);
  }

  console.log('downloaders finished');
}

export function getLogs() {
  const status = {};

  for (let worker of workers) {
    const { name, Downloader } = worker;
    status[name] = new Downloader().getLogs();
  }

  return status;
}
