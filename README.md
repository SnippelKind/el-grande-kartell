# El Grande Kartell – Finanzdashboard mit kostenloser Datenbank

Die Webseite läuft bei **Render** (Web Service, Free) und speichert sämtliche Buchungen zentral in **Neon PostgreSQL** (Free). Alle mit dem gemeinsamen Passwort eingeloggten Personen sehen dieselben Einträge.

## 1. Kostenlose Datenbank bei Neon einrichten

1. Öffne https://console.neon.tech und registriere dich bzw. logge dich ein.
2. Wähle den **Free**-Tarif und erstelle ein neues Projekt, z. B. `el-grande-kartell`.
3. Wähle eine europäische Region (z. B. Frankfurt), soweit angeboten.
4. Kopiere im Neon-Dashboard unter **Connect** die vollständige PostgreSQL-Verbindungsadresse (`postgresql://...`). Wähle nach Möglichkeit die **pooled** Verbindung.
5. Die Verbindungsadresse enthält geheime Zugangsdaten. Teile sie niemals öffentlich und speichere sie nicht in GitHub.

## 2. Render konfigurieren

1. Lade den entpackten Projektordner in ein GitHub-Repository hoch.
2. Öffne https://dashboard.render.com und erstelle **New > Web Service** mit diesem Repository.
3. **Language/Runtime:** Node; **Build Command:** `npm install`; **Start Command:** `npm start`; **Instance Type:** Free.
4. Unter **Environment** erstelle folgende Variablen:
   - `DATABASE_URL` = die vollständige Neon-Verbindungsadresse aus Schritt 1
   - `APP_PASSWORD` = `Wirtschaft` (empfohlen: ein eigenes starkes Passwort setzen)
5. Klicke auf **Deploy Web Service**. Der Server erstellt die benötigte Tabelle automatisch.
6. Die bereitgestellte Render-URL aufrufen und anmelden.

## 3. Funktionsumfang

- Passwortgeschützter Zugang (serverseitig, Cookie mit HttpOnly)
- Einnahmen und Ausgaben erfassen und löschen
- Dashboard mit Einnahmen, Ausgaben, Saldo und Buchungen
- Filter, Suche und Monatsberichte
- Gemeinsame, dauerhaft gespeicherte PostgreSQL-Datenbank

**Wichtig:** Für alle Benutzer gilt dasselbe Passwort; es gibt noch keine getrennten Benutzerkonten oder Berechtigungen. Jedes angemeldete Mitglied darf Buchungen löschen. Für echte sensible Finanzdaten sind einzelne Benutzerkonten, Audit-Protokoll, Backups und weitere Sicherheitsmaßnahmen empfehlenswert.

## 4. Kostenlos – Grenzen

- Neon Free: gemäß Stand November 2026 1 GB Speicher pro Projekt, Kontingente für Compute und Datenverkehr. Prüfe die aktuellen Konditionen unter https://neon.com/pricing.
- Render Free: Web Service kann nach Leerlauf einschlafen und beim nächsten Aufruf verzögert starten.
- Render **Free Postgres** wird nicht verwendet: dessen kostenlose Datenbank läuft nach 30 Tagen ab.
- Neon ist unabhängig von Render. Neustarts oder Deployments von Render löschen daher **nicht** die Neon-Buchungen.
- Bitte regelmäßig einen Datenexport bzw. Sicherungskopie aus Neon erstellen; ein kostenloser Tarif ersetzt keine Backup-Strategie.

## 5. Lokal testen

1. Node.js ab Version 20 installieren.
2. `npm install` ausführen.
3. Die Umgebungsvariablen `DATABASE_URL` und `APP_PASSWORD` im Terminal setzen (siehe `.env.example`; das Beispiel wird nicht automatisch geladen).
4. `npm start` ausführen, dann http://localhost:3000 öffnen.

### Bereits vorhandene Buchungen aus der alten JSON-Version?

Wenn du bisher die ältere Variante mit `data/finances.json` genutzt hast, werden diese Einträge **nicht automatisch importiert**. Das schützt vor versehentlichen Doppelbuchungen. Kontaktiere mich für eine einmalige Übernahme der vorhandenen Datei in Neon.
