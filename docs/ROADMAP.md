# Roadmap – Stand und offene Ideen

Stand: Oktober 2026 (nach PR #55). Die Nummern beziehen sich auf die Liste fehlender fachlicher
Funktionen, abgeglichen mit dem Ablauf der morphologischen Methode.

## Umgesetzt

Grundlagen: Matrix mit Kategorien, Notizen und Suche · Verträglichkeiten (unverträglich / bedingt) mit
Zählung der widerspruchsfreien Kombinationen (Web Worker) · Konzepte, auch automatisch erzeugt ·
Bewertung mit Kosten, gewichtetem Nutzwert, Preis-Leistung und MoSCoW · Vergleich als Tabelle und
Verlauf · Export, Teilen-Links, Backup, Druck · Deutsch/Englisch · App-Tabs.

Aus der Liste:

| Nr. | Funktion | Kern |
| --- | --- | --- |
| 1 | Eingrenzen beim Kombinieren | Restzahlen je Ausprägung zur Auswahl des aktiven Konzepts (Worker) |
| 2 | Lösungsraum als Liste | Dialog mit Festlegen per Klick, Filtern, Sortierung, „＋ Konzept“; Branch & Bound für große Räume (`js/solutions.js`) |
| 6 | Kosten/Nutzen-Streudiagramm | Pareto-Front, im Vergleich und im Bericht |
| 7 | Status je Konzept | Entwurf, Favorit, verworfen (mit Grund), gewählt – Datenformat 6 |
| 9 | Bericht / Export-Dialog | HTML und Markdown (`js/report.js`), CSV, Drucken |
| – | Eigene Merkmale | beschreibende Werte je Ausprägung mit Zusammenfassung je Konzept und Grenzen – Datenformat 7 |
| – | Vorlagen für Merkmale | 16 Vorlagen in fünf Gruppen (DE/EN), darunter Kano-Kategorie und Wert/Aufwand; Grenze „unter Stufe“ und Zusammenfassung „Anzahl je Stufe“ |

## Fertig, aber bewusst nicht übernommen

**4 – Bewertung nach Kriterien** (Branch `claude/nutzwert-kriterien`, Commit `e73d02c`, darauf ein
älterer Stand der Merkmale): mehrere gewichtete Kriterien statt eines Nutzwerts je Ausprägung, Bewertung
im Popover und in einer Tabelle, Aufschlüsselung im Vergleich, Bericht und CSV.
Der Branch basiert auf einem Stand vor den eigenen Merkmalen und vor dem Lösungsraum. Zum Übernehmen:

- neu auf `main` aufsetzen; das Datenformat wird dann **8** (Migration `score` → `scores: { nw: n }`, `settings.criteria`),
- die Tabelle der Merkmale (`#attrDialog`) und die Bewertungstabelle zu einem Dialog mit Reitern „Nutzwert“ / „Eigene Merkmale“ zusammenführen (so war es im Branch),
- `js/solutions.js` auf den Nutzwert nach Kriterien umstellen (Beitrag je Ausprägung = gewichtetes Mittel; linear, Schranken bleiben gültig),
- gemeinsame Popover-/Tabellen-Stile (`score-*` in `css/attributes.css`) nicht doppelt anlegen.

## Offen

- **3 – Mehrfachwahl je Parameter:** Varianten bzw. Lösungsfamilien („Mahlwerk A *oder* B“). Ändert das Datenformat und berührt Bewertung, Verträglichkeiten, Vergleich und Export – großer Aufwand.
- **5 – Sensitivitätsanalyse:** Wie stabil ist die Rangfolge, wenn sich Gewichte ändern? Schieberegler mit Live-Rangfolge oder „Rang kippt ab Gewicht x“. Mittlerer Aufwand; mit Kriterien (4) aussagekräftiger.
- **8 – Stände festhalten:** benannte Versionen einer Matrix („vor Workshop“ / „nach Workshop“) mit Vergleich der Unterschiede. Mittlerer Aufwand.
- **10 – Abstimmen im Team:** Punkte an Ausprägungen oder Konzepte vergeben und zusammenfassen. Ohne Server nur über Teilen-Links, die zusammengeführt werden.

## Zurückgestellt (Entscheidung des Maintainers)

- neue Standardbewertungen (über Kosten, Nutzwert, MoSCoW hinaus) – später entscheiden
- geräteübergreifendes Arbeiten / Synchronisation (inkl. QR-Code-Mockups)
- Immer bzw. Valibot als Bibliotheken

## Ideen für Folgeschritte zu den Vorlagen

- Weitere Vorlagen ergänzen.
- Erlaubter Bereich (min/max) für Zahlen-Merkmale, z. B. für Punkte-Skalen.
- Diagramm mit frei wählbaren Achsen und Quadranten (Wert vs. Aufwand als Grafik) – vorerst nicht nötig, die Stufen-Vorlage deckt den Bedarf.
- Eigene Vorlagen: „Als Vorlage speichern“ an einem Merkmal, gespeichert im Browser und im Backup.
- **Berechnete Merkmale:** ein Merkmal, dessen Wert je Ausprägung per Formel aus anderen Merkmalen entsteht – z. B. RICE (Reach × Impact × Confidence ÷ Effort) oder eigene gewichtete Wertungen. Größerer Schritt: ändert das Datenformat (Formel, Verweise auf andere Merkmale, Zyklen ausschließen) und berührt Zusammenfassung, Sortierung und Lösungsraum. RICE als reine Vorlage (vier getrennte Merkmale) wurde bewusst nicht aufgenommen: Ohne Berechnung entsteht kein RICE-Wert, und für Alternativen je Parameter deckt Wert/Aufwand den Kern bereits ab.

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
