import express from 'express';
import cors from 'cors';
import { resolve } from 'path';

import { Database } from './lib/database';
import { getLogs } from './download';

const port = parseInt(process.argv[2], 10) || 8080;
const database = Database();
const app = express();

app.use(cors());

app.get('/', (req, res) => res.status(200).send('ok'));

app.get('/robots.txt', (req, res) =>
  res.type('text/plain').send('User-agent: *\nDisallow: /')
);

app.get('/query/:tableName', (req, res) => {
  try {
    let result = database.queryData(req.params.tableName, req.query);
    res.status(200).set('Content-Type', result.mime).send(result.body);
  } catch (e: any) {
    console.log(e);
    res.status(500).send(e.message);
  }
});

app.get('/meta/tables', (req, res) => {
  try {
    res.status(200).json(database.getTables());
  } catch (e: any) {
    console.log(e);
    res.status(500).send(e.message);
  }
});

app.get('/meta/fields/:tableName', (req, res) => {
  try {
    res.status(200).json(database.getFields(req.params.tableName));
  } catch (e: any) {
    console.log(e);
    res.status(500).send(e.message);
  }
});

app.get('/meta/logs', (req, res) => {
  try {
    res.status(200).json(getLogs());
  } catch (e: any) {
    console.log(e);
    res.status(500).send(e.message);
  }
});

app.use('/assets', express.static(resolve(__dirname, '../web/assets')));
app.use(
  '/generator',
  express.static(resolve(__dirname, '../web/generator.html'))
);
app.use('/status', express.static(resolve(__dirname, '../web/status.html')));

database.start().then(() => {
  app.listen(port, () => {
    console.log('listening at port ' + port);
  });
});
