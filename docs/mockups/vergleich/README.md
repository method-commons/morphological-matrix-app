# Mockups – Versionen vergleichen (Stufe 4)

Entwürfe für den Vergleich zweier Stände einer Matrix, hier zuerst in der Morphologischen Matrix. Die
Übersichtsseite aller Dokumente (ebenfalls Stufe 4 im Konzept) ist bewusst nicht Teil dieser Runde.
Konzept: [method-commons/sync – docs/KONZEPT.md](https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md);
Grundlage ist Stufe 2 ([Mockups Versionen](../versionen/README.md)).

Die Bilder sind **Screenshots der echten App mit eingerichteter Ablage** (GitHub-API nachgebildet, mit früheren
Ständen) und eingeblendetem Entwurf (gekennzeichnet mit „Entwurf“ bzw. gestrichelt umrandet). Die Matrix ist das
mitgelieferte Beispiel „Kaffeemaschine“; die früheren Stände, Uhrzeiten, Geräte und Änderungen sind erfunden.
**Noch nichts davon ist umgesetzt.**

| # | Ansicht | Datei |
|---|---------|-------|
| 1 | **Versionen**: je früherem Stand zusätzlich „Vergleichen“ (mit dem aktuellen Stand). | `c1-versionen.png` |
| 2 | **Vergleich**: „Von“ und „Bis“, Kennzahlen vorher → nachher, Filter (neu, geändert, entfernt) und die Änderungen nach Bereichen (Konzepte, Ausprägungen, Parameter, Werte); unten „Ansehen“, „Wiederherstellen …“ und „In der Matrix zeigen“. | `c2-vergleich.png` |
| 3 | **Seiten wählen**: Beide Seiten frei wählbar, benannte Stände hervorgehoben; ⇄ tauscht die Richtung. | `c3-auswahl.png` |
| 4 | **In der Matrix zeigen**: der aktuelle Stand mit markierten Unterschieden (grün neu, gelb geändert, rot entfernt), Leiste oben mit „Liste der Änderungen“ und „Hervorhebung beenden“. | `c4-matrix.png` |
| 5 | **Konflikt**: Im Konfliktdialog „Unterschiede“ aufklappen, bevor man sich entscheidet. | `c5-konflikt.png` |
| 6 | **Schmal**: Vergleich auf dem Telefon (Seiten untereinander). | `c6-schmal.png` |

Bilder neu erzeugen: `npx vite build && npx vite preview &`, dann `node docs/mockups/vergleich/aufnehmen.mjs`.

## Verhalten (Vorschlag)

- **Der Browser vergleicht**, die Ablage liefert nur die beiden Stände (wie „Ansehen“: eine Anfrage je früherem
  Stand; der aktuelle Stand kommt aus dem Browser). Keine neuen Daten im Repo.
- **Was als Änderung gilt, weiß nur die App:** Sie vergleicht über die IDs (umbenannt ≠ entfernt + neu) und
  liefert eine Liste nach Bereichen. Für die Morphologische Matrix: Parameter, Ausprägungen, Konzepte (Auswahl,
  Status, Notiz), Werte und Bewertungen, Kategorien, Ausschlüsse, Gesamtfunktion und Einstellungen. Texte als
  „vorher → nachher“, lange Texte gekürzt („Notiz ergänzt“).
- **Die gemeinsame Oberfläche zeigt die Liste** (Dialog, Filter, Seitenwahl) – in allen Apps gleich.
- **In der Matrix zeigen** markiert die Unterschiede im aktuellen Stand; Bearbeiten bleibt möglich, die Markierung
  wird nach jeder Änderung neu berechnet. Entfernte Ausprägungen stehen am Parameter, entfernte Konzepte in der
  Leiste – das Raster bleibt gleich. Beim Ansehen eines früheren Stands (Stufe 2) gibt es dasselbe gegenüber dem
  aktuellen Stand.
- **Konflikt:** Unterschiede beider Seiten gegenüber dem gemeinsamen Ausgangsstand (der zuletzt abgeglichene
  Stand); zusammengeführt wird weiter von Hand („Beide behalten“ und übernehmen).

## Technik

| Aufgabe | Wo | Anfragen |
|---|---|---|
| Stände laden | Kern: `versionData(id, sha)` (gibt es schon) | 1 je früherem Stand |
| Unterschiede berechnen | App: neue Adapter-Funktion `diff(a, b)` → `[{ group, items: [{ kind: 'add' \| 'del' \| 'mod', label, detail }] }]` | – |
| Kennzahlen vorher/nachher | App: `summary` (gibt es schon) bzw. neue `metrics(data)` | – |
| Liste, Filter, Seitenwahl | Kern: Dialog in `ui/` | – |
| Markieren in der Ansicht | App: Hook `onCompare(diff \| null)`, Leiste aus dem Kern | – |
| Konflikt | Kern: Ausgangsstand = zuletzt abgeglichener Stand (`head` in der Merkliste) | 1 |

Ohne `diff` in einer App zeigt der Vergleich nur die Kennzahlen beider Stände. Danach folgen die übrigen vier Apps
mit ihrer eigenen `diff`-Funktion (RACI: Aufgaben, Rollen, Zellen; 2-Achsen: Einträge und Positionen; User
Stories: Stories, Kriterien, INVEST; 5 Why: Antworten, Maßnahmen).

## Offene Entscheidungen

1. **Darstellung:** Liste der Änderungen im Dialog und zusätzlich „In der Matrix zeigen“, oder nur die Liste? – Empfehlung: **beides**; die Liste zuerst in allen Apps, die Markierung je App.
2. **Seiten:** Standard „Stand → aktueller Stand“, beide Seiten frei wählbar? – Empfehlung: **ja**.
3. **Feinheit:** Änderungen auf Ebene der Elemente (Parameter, Ausprägung, Konzept, Wert) und Texte als „vorher → nachher“ – keine Hervorhebung einzelner Wörter? – Empfehlung: **ja**, Wort-Unterschiede höchstens später.
4. **Markieren während des Bearbeitens:** Bearbeiten bleibt möglich, Markierung wird neu berechnet? – Empfehlung: **ja** (sonst ein zweiter Nur-lesen-Modus).
5. **Konflikt:** „Unterschiede“ im Konfliktdialog? – Empfehlung: **ja**, zugeklappt.
6. **Einzelne Änderungen übernehmen** (z. B. nur das neue Konzept aus einem früheren Stand)? – Empfehlung: **nein, vorerst nicht**; dafür bleibt „Als Kopie öffnen“.
7. **Reihenfolge der Apps:** Morphologische Matrix zuerst (Vorlage), dann die übrigen vier? – Empfehlung: **ja**.

Nächster Schritt nach „Ja“: Vergleich im Kern (`method-commons/sync`: Dialog, Seitenwahl, Leiste, Konflikt), `diff`
in der Morphologischen Matrix, dann die übrigen vier Apps.
