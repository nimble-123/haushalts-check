# Sicherheit

## Was geschützt wird

Der Haushalts-Check ist eine statische Website ohne Server-Logik und ohne Nutzerkonten. Eingaben werden nur im Browser verarbeitet und gespeichert (localStorage). Relevante Risiken sind vor allem eingeschleuster Code im Browser (XSS), manipulierte Quelldaten und die Lieferkette der Abhängigkeiten.

Umgesetzte Maßnahmen:

- Content-Security-Policy je Seite (Astro, Hashes für alle Inline-Skripte und -Styles), dazu Security-Header über `vercel.json` (frame-ancestors, nosniff, Referrer-, Permissions- und Cross-Origin-Policies).
- Texte aus den Daten werden vor dem Einfügen als HTML escapt; ein Test prüft, dass die Daten keine HTML-Zeichen enthalten.
- Keine Drittanbieter im Browser: Schriften und Bibliotheken werden mitgebaut. Die Reichweitenmessung (Vercel Web Analytics) läuft cookielos über die eigene Domain und ist durch die CSP abgedeckt.
- Abhängigkeiten mit Lockfile, wöchentliche Updates über Dependabot, CI mit `npm ci`.
- Zugangsdaten der Daten-Pipeline nur lokal in `.env.local` (von Git ausgeschlossen).

## Ein Problem melden

Bitte melde Sicherheitsprobleme **nicht** über öffentliche Issues, sondern per E-Mail an **info@nilslutz.de** (siehe [Impressum](https://haushalts-check.vercel.app/impressum/)). Beschreib, was du gefunden hast und wie es sich nachstellen lässt. Du bekommst innerhalb einer Woche eine Antwort.

Unterstützt wird jeweils der aktuelle Stand auf `main`, der unter https://haushalts-check.vercel.app läuft.
