"use strict"

const express = require('express');
const { resolve } = require('path');
const cors = require('cors');
const Database = require('./lib/database.js');



const port = parseInt(process.argv[2], 10) || 8080;
const database = new Database();
const app = express();
app.use(cors())



app.get('/', (req, res) => res.status(200).send('ok'));

app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /'));

app.get('/query/:tableName', (req, res) => {
	try {
		let result = database.queryData(req.params.tableName, req.query)
		res.status(200).set('Content-Type', result.mime).send(result.body);
	} catch (e) {
		console.error(e);
		res.status(500).send(e.message);
	}
});

app.get('/meta/tables', (req, res) => {
	try {
		res.status(200).json(database.getTables());
	} catch (e) {
		console.error(e);
		res.status(500).send(e.message);
	}
});

app.get('/meta/fields/:tableName', (req, res) => {
	try {
		res.status(200).json(database.getFields(req.params.tableName));
	} catch (e) {
		console.error(e);
		res.status(500).send(e.message);
	}
});

/*
app.get('/status', (req, res) => {
	try {
		let result = database.getStatusHTML();
		res.status(200).set('Content-Type', 'text/html').send(result);
	} catch (e) {
		console.error(e);
		res.status(500).send(e.message);
	}
});
*/

app.use('/assets', express.static(resolve(__dirname, '../web/assets')));
app.get('/generator', (req, res) => {
	try {
		res
			.status(200)
			.set('Content-Type', 'text/html')
			.sendFile(resolve(__dirname, '../web/generator.html'));
	} catch (e) {
		console.error(e);
		res.status(500).send(e.message);
	}
});

database.start().then(() => {
	app.listen(port, () => {
		console.log('listening at port '+port)
	})
})
