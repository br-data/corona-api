# Corona-Deutschland-API v3

# Aufbau

Alle 10 Minuten prüft der Scraper, ob das RKI auf GitHub neue Daten veröffentlicht hat.

Gibt es neue Daten, dann werden sie runtergeladen und die Tabellen neu generiert.

Über den API-Server werden diese Tabellen angeboten. Mit GET-Parameter kann man die Daten filtern, sortieren und formatieren.

Unter [corona-api.interaktiv.br.de/generator](https://corona-api.interaktiv.br.de/generator) findet man ein Online-Tool, um eine API-Abfrage zu generieren.

# Installieren und Ausführen

```bash
git clone git@github.com:br-data/corona-api.git
cd corona-api
npm install
npm start
```

Dadurch wird der Server an Port 3000 gestartet.

Will man nur die RKI-Daten runterladen und vorbereiten, kann man den Downloader auch manuell starten mit:

```bash
node bin/download.js
````

# Tabellen

Aktuell werden die folgenden Tabellen generiert:

- Hospitalisierung:
	- ganz Deutschland: `hospitalisierung-de`
	- ganz Deutschland, nach Altersgruppen: `hospitalisierung-de-alt`
	- nach Bundesländern: `hospitalisierung-bl`
- Impfungen nach:
	- ganz Deutschland: `impfungen-de-serie`
	- ganz Deutschland, nach Impfstoff: `impfungen-de-full`
	- nach Bundesländern: `impfungen-bl-serie`
	- nach Bundesländern und Impfstoff: `impfungen-bl-full`
- Infektionen nach:
	- ganz Deutschland: `infektionen-de`
	- ganz Deutschland, nach Altersgruppen: `infektionen-de-alt`
	- nach Bundesländern: `infektionen-bl`
	- nach Bundesländern und Altersgruppen: `infektionen-bl-alt`
	- nach Landkreisen: `infektionen-lk`

Jede Tabelle enthält die Daten, die vom RKI bereitgestellt werden. Darüber hinaus werden noch ggf. weitere Daten hinzugefügt, wie z.B. Landkreisename, Einwohnerzahlen, Einwohner nach Altersgruppen etc. Basis dafür sind die Daten in `data/static`.

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

## weitere API-Calls

- Array aller Tabellen mit Datenstand als JSON: […/meta/tables](https://corona-api.interaktiv.br.de/meta/tables)
- Array aller Felder einer Tabelle als JSON, z.B.: […/meta/field/hospitalisierung-de-alt](https://corona-api.interaktiv.br.de/meta/fields/hospitalisierung-de-alt)

