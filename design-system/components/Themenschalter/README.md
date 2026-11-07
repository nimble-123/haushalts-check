Der Themenschalter wechselt zwischen hellem und dunklem Design.

**Verwenden** einmal pro Seite, ganz rechts im Kopf.

**Du lieferst** `<button class="rs-thema" type="button" aria-pressed="false" aria-label="Dunkles Design"><i aria-hidden="true"></i></button>`. `aria-pressed="true"` heißt: dunkles Design ist aktiv. Das Skript setzt `data-theme="light|dark"` auf `<html>` und merkt die Wahl im Browser (localStorage). Ohne gespeicherte Wahl gilt die Systemeinstellung. Diagramme hören auf die Änderung von `data-theme` und zeichnen sich neu.

**Nicht** als Text-Link oder mit Sonne/Mond-Bildern; das Zeichen ist der halb gefüllte Kreis, der sich beim Wechsel dreht.
