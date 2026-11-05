# El Grande Kartell – Finanzdashboard

Passwortgeschützte Finanzverwaltung mit HTML, CSS, JavaScript und kleinem Node.js-Server (ohne zusätzliche Pakete).

## Lokal starten

1. Node.js 20 oder neuer installieren.
2. Im Projektordner ein Terminal öffnen.
3. `npm start` ausführen.
4. `http://localhost:3000` öffnen.
5. Passwort: `Wirtschaft` (Groß-/Kleinschreibung beachten).

## Render.com bereitstellen

1. ZIP entpacken und den **Inhalt des Projektordners** in ein neues GitHub-Repository hochladen.
2. Render → **New** → **Web Service** → Repository verbinden.
3. Runtime: **Node**; Build Command: `npm install`; Start Command: `npm start`.
4. Unter **Environment** die Variable `APP_PASSWORD` anlegen und ein **eigenes sicheres Passwort** einsetzen. Ohne Variable gilt `Wirtschaft`.
5. Deploy starten und die Render-Adresse öffnen.

**Wichtig zur Datenspeicherung:** Standardmäßig landen Buchungen in `data/finances.json`. Auf Render ohne Persistent Disk ist das Dateisystem flüchtig: Ein Neustart oder Redeploy kann die Finanzdaten löschen. Für produktive Verwendung einen persistenten Speicher oder eine Datenbank verwenden! Mit Render Persistent Disk (sofern im Tarif verfügbar) Mount Path `/var/data` setzen und die Environment-Variable `DATA_FILE=/var/data/finances.json` anlegen. Auf Free-Web-Services ist Persistent Disk nicht verfügbar.

**Sicherheit:** Der Passwortcheck passiert auf dem Server, nicht im Browser. Sitzungen werden in Memory gehalten und verfallen nach 12 Stunden; nach Serverneustart muss man sich erneut anmelden. Alle Besucher mit gültigem Passwort sehen und bearbeiten dieselben Buchungen. Für sensible echte Unternehmens-/Finanzdaten empfiehlt sich zusätzlich Benutzerverwaltung, rollenbasierte Rechte, Backups und eine professionelle Datenbank.

## Funktionen

- Responsives Dark/Gold-Design und eigenes SVG-Logo
- Passwort-Login und Logout
- Einnahmen und Ausgaben anlegen
- Transaktionen suchen, filtern und löschen
- Kennzahlen, Kontostand und Monatsberichte
- Speicherung auf dem Server als JSON (vorbehaltlich der obigen Render-Einschränkung)
