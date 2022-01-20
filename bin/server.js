"use strict"

const port = parseInt(process.argv[2], 10) || 8080;



const express = require('express');
const cors = require('cors');
const Database = require('./lib/database.js');



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

app.get('/status', (req, res) => {
	try {
		let result = database.getStatusHTML();
		res.status(200).set('Content-Type', 'text/html').send(result);
	} catch (e) {
		console.error(e);
		res.status(500).send(e.message);
	}
});

app.get('/builder', (req, res) => {
	try {
		let result = database.getBuilderHTML();
		res.status(200).set('Content-Type', 'text/html').send(result);
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
