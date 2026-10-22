# Roadmap – Stand und offene Ideen

Stand: Oktober 2026 (nach PR #59; dazu Bewertung nach Kriterien). Die Nummern beziehen sich auf die Liste fehlender fachlicher
Funktionen, abgeglichen mit dem Ablauf der morphologischen Methode.

## Umgesetzt

Grundlagen: Matrix mit Kategorien, Notizen und Suche · Verträglichkeiten (unverträglich / bedingt) mit
Zählung der widerspruchsfreien Kombinationen (Web Worker) · Konzepte, auch automatisch erzeugt ·
Bewertung mit Kosten, gewichtetem Nutzwert, Preis-Leistung und MoSCoW · Vergleich als Tabelle und
Verlauf · Export, Links `#m=…` öffnen (eigenes Teilen per Link im Oktober 2026 entfernt – Angleichung an die übrigen Apps), Backup, Druck · Deutsch/Englisch · App-Tabs.

Aus der Liste:

| Nr. | Funktion | Kern |
| --- | --- | --- |
| 1 | Eingrenzen beim Kombinieren | Restzahlen je Ausprägung zur Auswahl des aktiven Konzepts (Worker) |
| 2 | Lösungsraum als Liste | Dialog mit Festlegen per Klick, Filtern, Sortierung, „＋ Konzept“; Branch & Bound für große Räume (`js/solutions.js`) |
| 6 | Kosten/Nutzen-Streudiagramm | Pareto-Front, im Vergleich und im Bericht |
| 5 | Sensitivitätsanalyse | Ansicht „Stabilität“ im Konzeptvergleich: Kipppunkte je Kriterium (exakt, `js/sensitivity.js`), Gewichte ausprobieren mit Live-Rangfolge und Übernehmen; Satz im Bericht; Ansicht immer sichtbar, ohne Voraussetzungen mit Erklärung und Checkliste |
| 7 | Status je Konzept | Entwurf, Favorit, verworfen (mit Grund), gewählt – Datenformat 6 |
| 9 | Bericht / Export-Dialog | HTML und Markdown (`js/report.js`), CSV, Drucken |
| 4 | Bewertung nach Kriterien | mehrere gewichtete Kriterien statt eines Nutzwerts je Ausprägung; Bewertung im Popover und in einer Tabelle, Aufschlüsselung im Vergleich, Bericht und CSV; Lösungsraum rechnet mit dem gewichteten Mittel (`js/scores.js`); Bewertungs- und Merkmal-Tabelle in einem Dialog mit Reitern, Kosten als erste Spalte der Bewertungstabelle – Datenformat 8 |
| – | Eigene Merkmale | beschreibende Werte je Ausprägung mit Zusammenfassung je Konzept und Grenzen – Datenformat 7 |
| – | Vorlagen für Merkmale | 16 Vorlagen in fünf Gruppen (DE/EN), darunter Kano-Kategorie und Wert/Aufwand; Grenze „unter Stufe“ und Zusammenfassung „Anzahl je Stufe“ |

## Offen

- **3 – Mehrfachwahl je Parameter:** Varianten bzw. Lösungsfamilien („Mahlwerk A *oder* B“). Ändert das Datenformat und berührt Bewertung, Verträglichkeiten, Vergleich und Export – großer Aufwand.
- **8 – Stände festhalten:** benannte Versionen einer Matrix („vor Workshop“ / „nach Workshop“) mit Vergleich der Unterschiede. Mittlerer Aufwand.
- **10 – Abstimmen im Team:** Punkte an Ausprägungen oder Konzepte vergeben und zusammenfassen. Ohne Server nur über Links bzw. Dateien, die zusammengeführt werden; mit Ablage siehe Teilen im Konzept von method-commons/sync.

## Zurückgestellt (Entscheidung des Maintainers)

- neue Standardbewertungen (über Kosten, Nutzwert, MoSCoW hinaus) – später entscheiden
- geräteübergreifendes Arbeiten / Synchronisation (inkl. QR-Code-Mockups) – **umgesetzt als Ablage im eigenen GitHub-Repo** (Stufe 1 des gemeinsamen Konzepts [method-commons/sync](https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md)) und mit Versionen (Stufe 2: Liste, benannte Stände, Ansehen, Wiederherstellen); Supabase (Stufe 3) folgt
- Immer bzw. Valibot als Bibliotheken

## Ideen für Folgeschritte zu den Vorlagen

- Weitere Vorlagen ergänzen.
- Erlaubter Bereich (min/max) für Zahlen-Merkmale, z. B. für Punkte-Skalen.
- Diagramm mit frei wählbaren Achsen und Quadranten (Wert vs. Aufwand als Grafik) – vorerst nicht nötig, die Stufen-Vorlage deckt den Bedarf.
- Eigene Vorlagen: „Als Vorlage speichern“ an einem Merkmal, gespeichert im Browser und im Backup.
- **Berechnete Merkmale:** ein Merkmal, dessen Wert je Ausprägung per Formel aus anderen Merkmalen entsteht – z. B. RICE (Reach × Impact × Confidence ÷ Effort) oder eigene gewichtete Wertungen. Größerer Schritt: ändert das Datenformat (Formel, Verweise auf andere Merkmale, Zyklen ausschließen) und berührt Zusammenfassung, Sortierung und Lösungsraum. RICE als reine Vorlage (vier getrennte Merkmale) wurde bewusst nicht aufgenommen: Ohne Berechnung entsteht kein RICE-Wert, und für Alternativen je Parameter deckt Wert/Aufwand den Kern bereits ab.

## Ideen für Folgeschritte zur Stabilität

- Gewichte der Parameter variieren (Umschalter „Kriterien | Parameter“) – dann auch mit nur einem Kriterium sinnvoll.
- Mehrere Gewichte gleichzeitig (z. B. Monte-Carlo: wie oft liegt welches Konzept vorn).

## Ideen für Folgeschritte zum Lösungsraum

- In sehr großen Räumen mit mehreren gleichzeitigen Filtern (Kosten bis + Merkmal-Grenzen) reicht das Rechenbudget mitunter nicht; bessere Schranken (z. B. Lagrange-Relaxation) oder ein Abbruch mit „weiter suchen“ wären möglich.
- Export der Trefferliste (CSV) und Vergleich ausgewählter Treffer ohne sie als Konzept anzulegen.

## Quelltext und Infrastruktur (hinten angestellt)

Umgesetzt: (A) Veröffentlichung erst nach grüner CI, Browser-Cache in der CI, Mindestabdeckung, Dependabot;
(B) Grenzregeln in `js/limits.js` und `Attributes.marksMissing` zusammengeführt, `attributes.jsx` und
`render-panels.jsx` aufgeteilt.

Offen, bewusst nach den fachlichen Themen:

- **C – Typen und große Updates:**
  - strengere Typprüfung der Oberfläche: `noImplicitAny` für `js/ui/` Datei für Datei einschalten (die Logik in `js/*.js` ist schon streng geprüft),
  - TypeScript 7 (neuer, deutlich schnellerer Compiler) und Preact 11 jeweils einzeln prüfen; Dependabot schlägt große Versionen bewusst nicht vor.
- **D – optional:**
  - Bundle verkleinern (Haupt-Bundle 249 kB, gezippt 80 kB): die inaktive Sprache nachladen (rund 10–12 kB gezippt) sowie selten genutzte Teile wie Lösungsraum, Merkmal-Tabelle und Kosten/Nutzen-Diagramm,
  - E2E-Tests zusätzlich in Handy-Breite (390 px) für einige markierte Tests.
