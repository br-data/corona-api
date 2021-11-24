# Corona-Deutschland-API v3

# Aufbau

Alle 10 Minuten prüft der Scraper nach neuen Daten.

Gibt es neue Daten, dann werden sie runtergeladen und die Tabellen neu generiert.

# Tabellen

Es gibt 4 Tabellen mit folgenden Primary-Keys:

- Landkreise, Meldetag
- Regierungsbezirke, Meldetag
- Bundesländer, Meldetag
- Deutschland, Meldetag
- Altersgruppen, Wochen

# Felder

Jede Tabelle enthält erstmal nur die grundlegenden Metadaten (Bevölkerung, Regierungsbezirk, Lat/Long, ...)

Jetzt werden nach und nach Berechnungsskripte aufgerufen, die die Tabellen um Wertespalten ergänzen, z.B.
- Coronainzidenz ergänzt "Landkreise", "Bundesländer" und "Deutschland" um Inzidenzberechnung
- Hopitalisierungsscript ergänzt Tabelle "Altersgruppen", Bundesländer" und "Deutschland" um die Felder Hopitalisierung-Fälle und Hopitalisierung-Inzidenz
- …

Dieses Konzept ist im Kern das gleiche wie bei den "Data-Workers", bloß dass nicht neue CSV-Dateien angelegt werden, sondern neue Felder in den Tabellen.

# API

Die API bietet jetzt einfach nur noch Filter- und Formatierungsmöglichkeiten an:

- Filtern nach einem Wert einer Spalte, z.B. nach Bundesland oder Datum, …
- Wertespalten müssen explizit angegeben werden. Zeilen mit null-Werten werden nicht ausgegeben.
- spezielles Filterflag `recent = 1day`, um in Zeitreihen nur den letzten Tag auszugeben
- spezielles Filterflag `format = csv`, um als Datenformat csv, tsv oder json auszuwählen 

Beispiel für eine Query:

`https://corona-api3.interaktiv.br.de/landkreise?bundesland=bayern&recent=1week`
