# Mockups – Teilen zum Ansehen (GitHub-Ablage)

Entwürfe für einen Link, mit dem andere eine Matrix **nur ansehen** – ohne Konto und ohne Ablage. Grundlage:
[method-commons/sync – KONZEPT.md, „Entwurf: Links zum Teilen aus einer GitHub-Ablage“](https://github.com/method-commons/sync/blob/main/docs/KONZEPT.md).
Das bisherige „Link zum Teilen kopieren“ (Matrix im Link `#m=…`) ist entfernt – die übrigen Methoden-Apps hatten es
nicht; Links `#m=…` (z. B. aus dem Skill „morphologische-matrix“) öffnet die App weiterhin.

Die Bilder sind **Screenshots der echten App mit eingerichteter Ablage** (GitHub-API nachgebildet) und
eingeblendetem Entwurf (gekennzeichnet mit „Entwurf“ bzw. gelb gestrichelt). Matrix: Beispiel „Kaffeemaschine“;
Namen, Zeiten und Link sind erfunden. **Noch nichts davon ist umgesetzt** (außer dem Entfernen des alten Teilens).

| # | Ansicht | Datei |
|---|---------|-------|
| 1 | **Token anlegen**: im Einrichtungsassistenten ein vorbelegter Link zu GitHub (Contents, Gists, 90 Tage) statt drei Hinweisen; Hinweis auf „Resource owner“. | `t1-token.png` |
| 2 | **Menü „Datei“**: „Teilen …“ unter „Versionen …“; das alte „Link zum Teilen kopieren“ ist weg. | `t2-menue.png` |
| 3 | **Teilen**: Erklärung (nur lesen, wer den Link hat, kann sehen), „Link erstellen“. | `t3-teilen.png` |
| 4 | **Geteilt**: Link zum Kopieren, seit wann, Stand im Link, Gist auf GitHub, „Teilen beenden …“. | `t4-geteilt.png` |
| 5 | **Berechtigung fehlt**: Token ohne „Gists“ – Hinweis und vorbelegter Link für ein neues Token. | `t5-berechtigung.png` |
| 6 | **Empfänger**: Matrix nur zum Lesen mit Leiste „Geteilte Matrix von … · Stand …“, „Aktualisieren“, „Als Kopie speichern“. | `t6-empfaenger.png` |
| 7 | **Meine Matrizen**: Kennzeichen „geteilt“. | `t7-liste.png` |
| 8 | **Empfänger auf dem Telefon**. | `t8-telefon.png` |

Bilder neu erzeugen: `npx vite build && npx vite preview &`, dann `node docs/mockups/teilen/aufnehmen.mjs`.

## Verhalten (Vorschlag)

- **Besitzer:** „Teilen … → Link erstellen“ legt ein *secret Gist* im eigenen GitHub-Konto an (Inhalt wie die Datei
  in der Ablage). Jeder Abgleich der Matrix schreibt den neuen Stand auch ins Gist. „Teilen beenden“ löscht das Gist.
- **Empfänger:** Der Link (`…/#g=<gist-id>`) öffnet die App; sie lädt das Gist **ohne Anmeldung** und zeigt die Matrix
  mit allen Ansichten **nur zum Lesen** (wie die Vorschau früherer Stände). **Keine Live-Ansicht:** neue Stände über
  „Aktualisieren“ oder erneutes Öffnen. „Als Kopie speichern“ legt eine eigene Matrix im Browser an.
- **Grenzen:** Wer den Link hat, kann die Matrix sehen (geheim ≠ privat). Bearbeiten durch andere ist nicht vorgesehen
  (bei GitHub nur für das ganze Repo möglich) – dafür später Supabase.

## Technik (GitHub)

| Aufgabe | API | Berechtigung |
|---|---|---|
| Link erstellen | `POST /gists` (`public: false`) | Token: Account permission „Gists: write“ |
| Stand aktualisieren | `PATCH /gists/{id}` (beim Abgleich) | wie oben |
| Teilen beenden | `DELETE /gists/{id}` | wie oben |
| Ansehen, Aktualisieren | `GET /gists/{id}` | keine (ohne Anmeldung) |
| Token anlegen | `github.com/settings/personal-access-tokens/new?name=…&contents=write&gists=write&expires_in=90` | – |

„Gists“ ist eine *Account permission* und erscheint nur, wenn das eigene Konto der Resource owner ist. Liegt das
Ablage-Repo in einer Organisation, braucht es ein zweites, persönliches Token nur für Gists. Die Gist-ID je Matrix
merkt sich die App in der Merkliste der Ablage (nicht im Datenformat der Matrix).

## Offene Entscheidungen

1. **Token mit Gists von Anfang an?** Vorbelegter Link fragt Gists immer mit an, oder nur auf Wunsch beim ersten Teilen? – Empfehlung: **immer** (ein Token, kein zweiter Gang zu GitHub); Repo in einer Organisation als Sonderfall mit zweitem Token.
2. **Ort im Menü:** „Teilen …“ im Menü „Datei“ (Entwurf) und zusätzlich in „Meine Matrizen“? – Empfehlung: **Menü „Datei“**, in der Liste nur das Kennzeichen.
3. **Gist-Inhalt:** nur die Matrix (Datenformat der App) oder der ganze Eintrag der Ablage (mit Gerät, Zeitpunkt)? – Empfehlung: **ganzer Eintrag** – zeigt „Stand von …“ und gleiche Prüfung wie beim Abgleich.
4. **Aktualisieren:** jeder Abgleich schreibt ins Gist (Entwurf) oder nur auf Knopfdruck „Link aktualisieren“? – Empfehlung: **jeder Abgleich** (der Link ist so immer aktuell; ein Schreibzugriff mehr je Abgleich).
5. **Für alle fünf Apps:** im Kern (`method-commons/sync`) bauen, Einbau wie bei den Versionen? – Empfehlung: **ja**, Morphologische Matrix zuerst.
6. **„Von Sven“:** Name aus dem GitHub-Konto oder Gerätename? – Empfehlung: **Gerätename** (ohne zusätzliche Abfrage; steht schon in der Ablage).

Nächster Schritt nach „Ja“: Teilen im Kern (`GitHubStore`: Gists; Dialog, Empfänger-Ansicht), dann Einbau in alle Apps.
