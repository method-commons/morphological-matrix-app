# Mockups – Versionen (Stufe 2)

Entwürfe für Versionen in der Ablage, hier zuerst in der Morphologischen Matrix: Liste der Stände einer Matrix,
benannte Stände („vor Workshop“), einen früheren Stand ansehen und wiederherstellen.
Konzept: [method-commons/sync – docs/KONZEPT.md](https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md);
Grundlage ist Stufe 1 ([Mockups Ablage](../ablage/README.md)).

Die Bilder sind **Screenshots der echten App mit eingerichteter Ablage** (GitHub-API nachgebildet) und
eingeblendetem Entwurf (gekennzeichnet mit „Entwurf“ bzw. gelb hinterlegt). Die Matrix ist das mitgelieferte
Beispiel „Kaffeemaschine“; Uhrzeiten, Geräte, Namen der Stände und die Zahl der Stände sind erfunden.
**Umgesetzt** mit den Entscheidungen wie empfohlen (siehe unten); die Bilder zeigen den Entwurf.

| # | Ansicht | Datei |
|---|---------|-------|
| 1 | **Menü „Datei“**: „Versionen …“ unter „Ablage …“, mit Hinweis auf die Zahl der Stände. | `v1-menue.png` |
| 2 | **Versionen**: Stände der Matrix nach Tagen, neueste zuerst; heute ausgeklappt, ältere Tage eingeklappt. Je Stand Uhrzeit, Gerät und Kennzahlen; benannte Stände hervorgehoben; „Ansehen“ und „Wiederherstellen …“; Filter „Nur benannte“; Link zum Verlauf auf GitHub. | `v2-versionen.png` |
| 3 | **Stand speichern**: aktuellen Stand sofort festhalten (auch innerhalb der 5 Minuten), mit Namen und optionaler Notiz. | `v3-stand-speichern.png` |
| 4 | **Ansehen**: Die App zeigt den früheren Stand mit allen Ansichten, nur lesen; Leiste oben mit „Wiederherstellen …“, „Als Kopie öffnen“ und „Zurück zum aktuellen Stand“; am Tab das Datum. | `v4-ansehen.png` |
| 5 | **Wiederherstellen**: Rückfrage mit beiden Ständen; der aktuelle Stand bleibt als Version erhalten. Alternativ „Als Kopie öffnen“. | `v5-wiederherstellen.png` |
| 6 | **Ohne Ablage**: „Versionen …“ erklärt, dass es Versionen mit der Ablage gibt, und bietet „Ablage einrichten …“ an. | `v6-ohne-ablage.png` |
| 7 | **Statusanzeige**: In den Details zusätzlich „Versionen …“. | `v7-statusanzeige.png` |

Bilder neu erzeugen: `npx vite build && npx vite preview &`, dann `node docs/mockups/versionen/aufnehmen.mjs`.

## Verhalten (Vorschlag)

- **Jeder übertragene Stand ist eine Version** – das sind die Commits der Datei im Repo (automatisch höchstens alle
  5 Minuten je Matrix, siehe Stufe 1). Es entsteht nichts Zusätzliches im Browser.
- **Stand speichern** überträgt sofort und benennt den Stand. Der Name bleibt erhalten, auch wenn danach viele
  automatische Stände folgen.
- **Ansehen** lädt den Stand aus der Ablage und zeigt ihn in der App; Bearbeiten ist gesperrt, bis man zurückgeht,
  wiederherstellt oder eine Kopie öffnet. Sonstige Ansichten (Lösungsraum, Vergleich, Export) funktionieren.
- **Wiederherstellen** übernimmt den Inhalt als neuen Stand der Matrix (neue Version, Gerät = dieses); der vorherige
  bleibt in der Liste. Verlauf (Rückgängig) beginnt danach neu.
- **Als Kopie öffnen** legt eine neue Matrix „Titel (Stand vom …)“ an – zum Vergleichen oder Übernehmen einzelner Teile.
- **Gelöschte Matrizen**: Ihre Stände bleiben im Repo, erscheinen aber in der App nicht (wie in Stufe 1 beschrieben).

## Technik (GitHub)

| Aufgabe | API | Anfragen |
|---|---|---|
| Liste der Stände | `GET /repos/{repo}/commits?path=<app>/<id>.json` (je Seite 30) | 1 je 30 Stände |
| Benannte Stände | `GET /repos/{repo}/git/matching-refs/tags/<app>/<id>/` | 1 |
| Stand ansehen | `GET /repos/{repo}/contents/<app>/<id>.json?ref=<sha>` | 1 |
| Stand benennen | Tag auf den Commit: `POST /git/tags` (mit Notiz) und `POST /git/refs` | 2 |
| Wiederherstellen | wie Übertragen (`PUT /contents/…` mit dem alten Inhalt) | 1 |

Kennzahlen je Stand (z. B. „6 Parameter · 3 Konzepte“) brauchen den Inhalt des Stands; die Liste lädt sie nur für
die sichtbaren Stände nach (höchstens einige Anfragen). Das fine-grained Token mit „Contents: Read and write“
genügt auch für Tags.

## Offene Entscheidungen

1. **Benannte Stände:** als Tag im Repo (`morphological-matrix-app/<id>/<name>`, sichtbar auf GitHub) oder nur als Commit-Nachricht? – Empfehlung: **Tag**, Notiz als Nachricht des Tags.
2. **Ohne Ablage:** nur Hinweis auf die Ablage (Entwurf) oder benannte Stände zusätzlich im Browser? – Empfehlung: **nur mit Ablage**; ohne Ablage bleiben JSON und Backup.
3. **Ansehen:** Vorschau in der App, nur lesen (Entwurf), oder nur Kennzahlen im Dialog? – Empfehlung: **Vorschau in der App**.
4. **Wiederherstellen:** als neuer Stand (Entwurf, nichts geht verloren) – zusätzlich „Als Kopie öffnen“? – Empfehlung: **ja, beides**.
5. **Liste:** heute ausgeklappt, ältere Tage eingeklappt, Filter „Nur benannte“? – Empfehlung: **ja**.
6. **„Stand speichern“** überträgt sofort, ohne auf die 5 Minuten zu warten? – Empfehlung: **ja**.
7. **Zugang:** Menü „Datei“ und Details der Statusanzeige? – Empfehlung: **beides**.
8. **Kennzahlen je Stand** in der Liste (braucht je Stand eine Anfrage) oder nur Zeit, Gerät und Name? – Empfehlung: **Kennzahlen für die sichtbaren Stände**, ältere erst beim Aufklappen.

Nächster Schritt nach „Ja“: Versionen im Kern (`method-commons/sync`: Ablage um `versions`, `getVersion`, `saveVersion`
erweitern, Dialog in `ui/`), dann Einbau in alle fünf Apps.
