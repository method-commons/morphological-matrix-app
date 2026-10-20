# Mockups – Ablage (Stufe 1)

Entwürfe für die gemeinsame Ablage der Methoden-Apps, hier zuerst in der Morphologischen Matrix:
Menü „Ablage …“, Assistent für ein GitHub-Repo mit persönlichem Token, Statusanzeige und Konfliktdialog.
Konzept und getroffene Entscheidungen: [method-commons/sync – docs/KONZEPT.md](https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md).

Die Bilder sind **Screenshots der echten App** mit eingeblendetem Entwurf (gekennzeichnet mit „Entwurf“ bzw.
gelb hinterlegt). Die Matrizen sind die mitgelieferten Beispiele „Kaffeemaschine“, „Food-Truck gründen“ und
„Elektro-Lastenrad“; Repo, Uhrzeiten, das zweite Gerät („Laptop“) und die Zahlen der anderen Apps sind erfunden.
**Noch nichts davon ist umgesetzt.**

| # | Ansicht | Datei |
|---|---------|-------|
| 1 | **Menü „Datei“**: neue Gruppe „Ablage …“ (mit Zustand, hier „nicht eingerichtet“) und „Versionen …“ (ab Stufe 2). Ohne Ablage ist das der einzige sichtbare Unterschied zu heute. | `a1-menue.png` |
| 2 | **Ablage einrichten – wählen**: GitHub-Repo (zuerst verfügbar) oder Supabase-Projekt (später). Hinweis: Die Ablage gilt für alle Methoden-Apps in diesem Browser. | `a2-ablage-waehlen.png` |
| 3 | **Verbinden**: privates Repo anlegen, fine-grained Token nur für dieses Repo mit „Contents – Read and write“; Direktlinks zu GitHub; Hinweis, wo das Token liegt und wofür es gilt. | `a3-github-verbinden.png` |
| 4 | **Prüfen & hochladen**: Prüfung (Repo erreichbar und privat, Schreibrecht, Ablauf des Tokens, Ordner der App), dann Auswahl der Matrizen zum Hochladen – hier zwei von drei. | `a4-pruefen-hochladen.png` |
| 5 | **Statusanzeige** in der Kopfzeile neben „Datei“, mit Klick-Details (Repo, letzte Übertragung, Takt der Versionen, „Jetzt übertragen“). Unten links die vier Zustände: in der Ablage, wird übertragen, offline, Konflikt. | `a5-statusanzeige.png` |
| 6 | **Konflikt**: dieselbe Matrix auf zwei Geräten geändert. Beide Stände mit Zeitpunkt, Gerät, Kennzahlen und kurzer Zusammenfassung; „Beide behalten“ (empfohlen), „Meine behalten“, „Ablage übernehmen“ – nichts geht verloren. | `a6-konflikt.png` |
| 7 | **Meine Matrizen** mit Zustand je Matrix (in der Ablage, wird übertragen, nur im Browser → „Hochladen“) und dem Abschnitt „Nur in der Ablage“ (z. B. auf dem Laptop angelegt → „Öffnen“). | `a7-meine-matrizen.png` |
| 8 | **Ablage** (eingerichtet): Repo, Ablauf des Tokens mit „Token erneuern“, Stand dieser und der anderen Apps, Takt der Versionen, Hinweis zum Löschen in Git; „Ablage trennen …“ und „Jetzt abgleichen“. | `a8-ablage-verbunden.png` |

Bilder neu erzeugen: `npx vite build && npx vite preview &`, dann `node docs/mockups/ablage/aufnehmen.mjs`
(nimmt die App mit fester Uhrzeit auf und blendet den Entwurf mit den Klassen der App ein).

## Verhalten (Vorschlag)

- **Ohne Ablage** ändert sich nichts außer dem Menüeintrag; der Sync-Kern wird erst geladen, wenn eine Ablage eingerichtet ist.
- **Übertragen:** nach dem Speichern gebündelt im Hintergrund; ein Commit höchstens alle 5 Minuten je Matrix, außerdem vor Import, Zurücksetzen und beim Verlassen der Seite (soweit der Browser das erlaubt). Ungesendetes bleibt im Browser und wird beim nächsten Öffnen nachgeholt.
- **Konflikt** erkennt GitHub selbst: Eine Datei lässt sich nur ändern, wenn der mitgeschickte Stand (`sha`) noch aktuell ist. Die Statusanzeige wird gelb, der Dialog öffnet sich beim Klick – nicht ungefragt mitten in der Arbeit.
- **Andere Tabs und Apps** im selben Browser teilen die Ablage; nur ein Tab überträgt, die anderen übernehmen dessen Ergebnis.
- **Token abgelaufen oder widerrufen:** Anzeige „Offline“ mit Hinweis „Token erneuern“; gearbeitet wird weiter im Browser.
- **Ablage trennen** löscht Token und Einstellungen in diesem Browser; Matrizen im Browser und im Repo bleiben erhalten.

## Entscheidungen

Getroffen im Oktober 2026: alle wie empfohlen, nur bei 6 mit dem Repo-Namen als Ordner.

1. **Ort der Statusanzeige:** in der Kopfzeile neben „Datei“ (Entwurf) oder nur als Symbol am Tab der Matrix? – Empfehlung: **Kopfzeile**; mobil nur das Symbol ohne Text.
2. **Takt der automatischen Versionen:** höchstens alle 5 Minuten je Matrix? – Empfehlung: **ja**, fest; einstellbar erst bei Bedarf.
3. **Konfliktdialog öffnen:** erst beim Klick auf die gelbe Anzeige (Entwurf) oder sofort? – Empfehlung: **beim Klick**, dazu ein Hinweis-Toast; vor dem nächsten Übertragen dieser Matrix muss entschieden sein.
4. **Vorauswahl beim Hochladen:** alle Matrizen angehakt? – Empfehlung: **ja, alle**; Beispiele, die unverändert sind, nicht angehakt.
5. **„Nur in der Ablage“ in „Meine Matrizen“** (Entwurf) oder in einem eigenen Dialog? – Empfehlung: **in „Meine Matrizen“**, eine Liste für alles.
6. **Dateiname im Repo:** `<Ordner>/<id>.json`, nur die ID – Umbenennen erzeugt sonst neue Dateien. **Entschieden: Ordner = Name des Repos** bzw. Teil der Pages-Adresse (`morphological-matrix-app/`, `raci-app/` …) – unabhängig von der Sprache und leicht der App zuzuordnen.
7. **Gerätename** (hier „Laptop“) für Konflikte und Versionen: automatisch aus dem Browser (z. B. „Chrome · Windows“) oder selbst benannt? – Empfehlung: **automatisch, im Dialog „Ablage“ änderbar**.

Nächster Schritt nach „Ja“: Stufe 1 im Repo [method-commons/sync](https://github.com/method-commons/sync) (Kern mit `memory`- und GitHub-Adapter), dann Einbau in diese App.
