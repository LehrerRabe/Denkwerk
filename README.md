# Denkwerk

Zusatzaufgaben für Schülerinnen und Schüler, die im Matheunterricht schnell fertig sind. Klasse 5 bis Q2, 23 Kategorien, 1740 Aufgaben (10 je Kategorie und Jahrgangsstufe) mit gestaffelter Hilfe und Lösungskontrolle.

## Auf GitHub Pages veröffentlichen

1. Auf github.com ein neues Repository anlegen, z. B. `Denkwerk` (öffentlich).
2. Alle Dateien aus diesem Ordner hochladen („Add file“ → „Upload files“), auch `aufgaben.js`, `app.js`, `app.css`, `manifest.webmanifest` und die Icons.
3. Unter **Settings → Pages** als Quelle „Deploy from a branch“, Branch `main`, Ordner `/ (root)` wählen.
4. Nach ein bis zwei Minuten ist die Seite erreichbar unter `https://<dein-konto>.github.io/Denkwerk/`.


## Wichtig zu wissen

- **Das Passwort ist nur eine Hürde.** Es steht nur verschlüsselt im Code und nicht in dieser Datei. Wer sich auskennt, kommt trotzdem rein. Für Übungsaufgaben ohne persönliche Daten reicht das.
- **Der Fortschritt bleibt auf dem Gerät.** Gespeichert wird im Browser des iPads. Es werden keine Daten an einen Server geschickt.
- **Zum Home-Bildschirm hinzufügen.** Safari löscht gespeicherte Daten von Webseiten, die 7 Tage nicht besucht wurden. Über *Teilen → Zum Home-Bildschirm* öffnet sich Denkwerk wie eine App, dann bleibt der Fortschritt erhalten.
- **Sicherung.** Schülerinnen und Schüler können ihren Fortschritt als Datei sichern und wieder laden. Veränderte Dateien werden abgelehnt.
- **Prüfcode auf Urkunden.** Er erschwert gefälschte oder nachträglich veränderte Urkunden. Weil alles ohne Server im Browser läuft, ist das kein echter Fälschungsschutz gegen jemanden, der den Code der Seite untersucht.
- Die Suchmaschinen-Sperre (`robots.txt`, `noindex`) sorgt dafür, dass die Seite nicht bei Google auftaucht.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst der Seite |
| `app.js` | Programm: Menüs, Glücksrad, Speichern, Hilfe, Prüfen |
| `app.css` | Gestaltung |
| `aufgaben.js` | Alle Aufgaben, Hilfen und Lösungen |
| `themen.js` | Zuordnung der Aufgaben zu Unterrichtsthemen (schulinternes Curriculum Kl. 5–10, KLP GOSt für EF–Q2) |
| `vendor/jspdf.umd.min.js`, `vendor/qrcode.js` | Fremdbibliotheken (MIT-Lizenz) für die Urkunde als PDF und QR-Codes |
| `manifest.webmanifest`, `icon-*.png` | App-Symbol für den Home-Bildschirm |
