# Denkwerk

Zusatzaufgaben für Schülerinnen und Schüler, die im Matheunterricht schnell fertig sind. Klasse 5 bis Q2, 23 Kategorien, 1218 Aufgaben (7 je Kategorie und Jahrgangsstufe) mit gestaffelter Hilfe und Lösungskontrolle.

## Auf GitHub Pages veröffentlichen

1. Auf github.com ein neues Repository anlegen, z. B. `Denkwerk` (öffentlich).
2. Alle Dateien aus diesem Ordner hochladen („Add file“ → „Upload files“), auch `aufgaben.js`, `app.js`, `app.css`, `manifest.webmanifest` und die Icons.
3. Unter **Settings → Pages** als Quelle „Deploy from a branch“, Branch `main`, Ordner `/ (root)` wählen.
4. Nach ein bis zwei Minuten ist die Seite erreichbar unter `https://<dein-konto>.github.io/Denkwerk/`.

Passwort für die Schüler: **Mathe-Genie**

## Wichtig zu wissen

- **Das Passwort ist nur eine Hürde.** Es steht verschlüsselt im Code, wer sich auskennt, kommt trotzdem rein. Für Übungsaufgaben ohne persönliche Daten reicht das.
- **Der Fortschritt bleibt auf dem Gerät.** Gespeichert wird im Browser des iPads. Es werden keine Daten an einen Server geschickt.
- **Zum Home-Bildschirm hinzufügen.** Safari löscht gespeicherte Daten von Webseiten, die 7 Tage nicht besucht wurden. Über *Teilen → Zum Home-Bildschirm* öffnet sich Denkwerk wie eine App, dann bleibt der Fortschritt erhalten.
- Die Suchmaschinen-Sperre (`robots.txt`, `noindex`) sorgt dafür, dass die Seite nicht bei Google auftaucht.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst der Seite |
| `app.js` | Programm: Menüs, Glücksrad, Speichern, Hilfe, Prüfen |
| `app.css` | Gestaltung |
| `aufgaben.js` | Alle Aufgaben, Hilfen und Lösungen |
| `manifest.webmanifest`, `icon-*.png` | App-Symbol für den Home-Bildschirm |
