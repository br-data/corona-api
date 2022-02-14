# Corona-API v3.0

# Einführung

Alle 10 Minuten prüft der Scraper, ob das [RKI auf GitHub](https://github.com/robert-koch-institut) neue Daten veröffentlicht hat.
Wenn es neue Daten gibt, dann werden sie autormatisch runtergeladen und in Tabellen konvertiert.
Über den API-Server werden dann diese Tabellen angeboten. Mit GET-Parameter kann man die Daten filtern, sortieren und formatieren.

Unter [corona-api.interaktiv.br.de/generator](https://corona-api.interaktiv.br.de/generator) findet man ein Online-Tool, um eine API-Abfrage zu generieren.

# Installieren und Ausführen

```bash
git clone git@github.com:br-data/corona-api.git
cd corona-api
npm install
npm start
```

Dadurch wird der Server an Port 3000 gestartet.

Will man nur die RKI-Daten runterladen, ohne den Server starten zu müssen, kann man den Downloader auch manuell ausführen mit:

```bash
node bin/download.js
````

# Tabellen

Aktuell werden die folgenden Tabellen generiert:

- Hospitalisierung: ([Datenquelle](https://github.com/robert-koch-institut/COVID-19-Hospitalisierungen_in_Deutschland))
	- ganz Deutschland: `hospitalisierung-de`
	- ganz Deutschland, nach Altersgruppen: `hospitalisierung-de-alt`
	- nach Bundesländern: `hospitalisierung-bl`
- Impfungen nach: ([Datenquelle](https://github.com/robert-koch-institut/COVID-19-Impfungen_in_Deutschland))
	- ganz Deutschland: `impfungen-de-serie`
	- ganz Deutschland, nach Impfstoff: `impfungen-de-full`
	- nach Bundesländern: `impfungen-bl-serie`
	- nach Bundesländern und Impfstoff: `impfungen-bl-full`
- Infektionen nach: ([Datenquelle](https://github.com/robert-koch-institut/SARS-CoV-2_Infektionen_in_Deutschland))
	- ganz Deutschland: `infektionen-de`
	- ganz Deutschland, nach Altersgruppen: `infektionen-de-alt`
	- nach Bundesländern: `infektionen-bl`
	- nach Bundesländern und Altersgruppen: `infektionen-bl-alt`
	- nach Landkreisen: `infektionen-lk`

Jede Tabelle enthält die Daten, die vom RKI bereitgestellt werden. Darüber hinaus werden noch ggf. weitere Daten hinzugefügt, wie z.B. Landkreisname, Einwohnerzahlen, Einwohner nach Altersgruppen etc. Basis dafür sind die Daten in `data/static`.

# API

Die Basis-URL für eine Datenabfrage ist: `https://corona-api.interaktiv.br.de/query/$tableId`

Für `$tableId` muss die entsprechende Id der Tabellen abgegeben werden, z.B.: https://corona-api.interaktiv.br.de/query/hospitalisierung-de Damit werden alle Daten dieser Tabelle als CSV zurückgegeben.

## Filtern

Man kann die Daten filtern mit dem Parameter `filter` der Form: `…&filter=$key$operator$value`
`$key` ist der Name eines Feldes der Tabelle, `$value` ist ein Wert und `$operator` ist einer der Vergleichsoperatoren: `==`, `!=`, `<=`, `>=`, `<`, `>`

Beispiel:

[`…query/hospitalisierung-bl?filter=datum>=2022-01-01`](https://corona-api.interaktiv.br.de/query/hospitalisierung-bl?filter=datum>=2022-01-01)

Möchte man nach mehreren Feldern filtern, so fügt man entsprechend mehrere `filter`-Parameter hinzu.

## Sortieren

Man kann die Daten sortieren mit dem Parameter `sort` der Form: `…&sort=$key$option`
`$key` ist der Name eines Feldes der Tabelle. `$option` kann man weglassen, um die Daten aufsteigend zu sortieren. Um die absteigend zu sortieren, fügt man `=desc` an.

Beispiel:

[`…query/hospitalisierung-bl?sort=datum=desc`](https://corona-api.interaktiv.br.de/query/hospitalisierung-bl?sort=datum=desc)

Möchte man nach mehreren Feldern sortieren, so fügt man entsprechend mehrere `sort`-Parameter hinzu.

## Formatieren

Momentan werden zwei Formate angeboten:
- `format=csv`: CSV ist der Default.
- `format=json`: JSON als Alternative.

Beispiel:

[`…query/hospitalisierung-de?format=json`](https://corona-api.interaktiv.br.de/query/hospitalisierung-de?format=json)

# Aufbau

Die API besteht grob aus zwei Teilen: Den Downloadern und dem API-Server.

## Verzeichnisse

- `bin` enthält die zentralen Scripte
	- `bin/download.js` führt alle Downloader aus
	- `bin/downloaders` enthält die Downloader, jeweils einen für jede Datenquelle
		- `bin/downloaders/prototype` ist die abstrakte Downloader-Klasse, von der die Downloader erben.
	- `bin/server.js` ist der API-Server
	- `bin/lib` enthält Helfer-Bibliotheken
		- `bin/lib/config.js` enthält zentrale Konfigurationen, wie z.B. die Verzeichnisnamen für die Daten
		- `bin/lib/database.js` verarbeitet die Queries für den API-Server
		- `bin/lib/helper.js` enthält Hilfsfunktionen, wie z.B. einen CSV-Parser etc.
- `data` ist das zentrale Verzeichnis für alle Daten.
	- `data/log` sammelt Ergebnisse der Downloader
	- `data/static` enthält statische Metadaten wie z.B. Bevölkerungszahlen für die Berechnung der Inzidenzen.
	- `data/status` enthält die letzten Status-Informationen der Downloader.
	- `data/tables` enthält die Tabellen, die von den Downloadern generiert werden.
- `web` enthält statischen Web-Content, z.B. den Code für den Query-Generator.

## Die Downloader

Die Downloader können manuell aufgerufen werden mit `node bin/download.js`. Mit dem Parameter `node bin/download.js cached` werden die Daten nicht erneut heruntergeladen, was die Verarbeitung beim Entwickeln beschleunigt. Um die Entwicklung zu vereinfachen, gibt es eine abstrakte Downloader-Klasse `bin/downloaders/prototype.js`, von der die einzelnen Downloader erben. Die Methode `async run()` geht dabei folgender Maßen vor:

### `loadStatus()`

Lade den Status vom letzten Mal. "Status" ist dabei ein kleines Objekt, dass einige Informationen über den jeweiligen Downloader speichert. Insbesondere der Hash ist wichtig, damit sichergestellt wird, dass bereits heruntergeladene Daten nicht alle 10 Minuten neu runtergeladen werden. Der Hash wird also verwendet, um Änderungen an der Datenquelle zu überprüfen.

### `checkUpdates()`

Überprüfe den Hash der jeweiligen Datenquelle auf GitHub. Hat er sich geändert, dann gibt es neue Daten, die runtergeladen und verarbeitet werden müssen. Hat sich der Hash im Status nicht geändert, können alle Verarbeitungsschritte übersprungen werden.

### `doUpdate()`

Führe eine Aktualisierung der Daten durch. Hier unterscheiden sich die jeweiligen Downloader, da jede Datenquelle andere Verarbeitungsschritte benötigt.

Das Vorgehen ist dabei immer das selbe:

1. Lade die Daten von GitHub runter.
2. Parse die Daten, z.B. wenn es sich um eine CSV-Datei handelt.
3. Gehe alle Einträge durch, parse Sonderformate wie Datum oder Altersgruppen und sortiere die Einträge in die jeweiligen Tabellen.
4. Füge den Tabellen weitere Metadaten hinzu, z.B. die Einwohnerzahl nach Altersgruppen etc.
5. Führe ggf. weitere Berechnungen durch, wie z.B. die Berechnung der 7-Tage-Inzidenz.
6. Speichere die Tabellen auf der Festplatte.

### `saveStatus()`

Sichere das Status-Objekt für den nächsten Durchlauf. Im Verzeichnis `data/status` sind die letzten Status-Objekte gesichert. In `data/log` sind alle historischen Objekte mt Zeitstempel gespeichert.

## Server

Der Server in `bin/server.js` ist die Schnittstelle nach außen. Neben der API bietet er auch weitere Funktionen an, z.B. einen Query-Generator unter [corona-api.interaktiv.br.de/generator](https://corona-api.interaktiv.br.de/generator) und weitere API-Calls, wie:
- Array aller Tabellen mit Datenstand als JSON: […/meta/tables](https://corona-api.interaktiv.br.de/meta/tables)
- Array aller Felder einer Tabelle als JSON, z.B.: […/meta/field/hospitalisierung-de-alt](https://corona-api.interaktiv.br.de/meta/fields/hospitalisierung-de-alt)

Die eigentliche Verarbeitung der Query wird in `bin/lib/database.js` durchgeführt:

### `bin/lib/database.js`

Die Methode `updateData()` triggert die Downloader, und lädt dann die Daten aus `data/tables/*.json`.

Die Methode `queryData(tableName, query)` ist das Herz der API. Hier wird in den folgenden Schritten eine Abfrage bearbeitet:+
1. Hole eine Kopie der Tabelle mit dem Namen `tableName`.
2. Filtere die Daten anhand der GET-Parameter `filter`.
3. Sortiere die Daten anhand der GET-Parameter `sort`.
4. Limitiere die Anzahl der Ergebnisse anhand des GET-Parameters `limit`.
5. Formatiere die Daten anhand des GET-Parameters `format`.
