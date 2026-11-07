Der Anteilsbalken teilt einen Betrag in seine Teile, auf einer Zeile.

**Verwenden** für „Dein Brutto“ (Steuern, Sozialversicherung, Netto) und überall, wo zwei bis sechs Teile ein Ganzes bilden.

**Du lieferst** `<div class="rs-anteil">` mit je einem `<i style="flex:<Betrag>;background:…">` pro Teil, darunter eine Liste `rs-anteil-legende` mit Beträgen. Netto in `marker`, Steuern in `ink`, Sozialversicherung schraffiert, geschätzte Konsumsteuern gegenschraffiert in `ink` (`rs-hatch-konsum`).

**Nicht** für Vergleiche zwischen Ganzen; dafür Balken.
