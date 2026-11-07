Der Textknopf ist eine kleine Aktion im Fließtext, die wie ein Link aussieht, aber etwas auf der Seite tut.

**Verwenden** für Nebenaktionen neben dem Inhalt: „In meiner Nähe“ unter dem Eingabesatz, „Eingaben vergessen“ in den weiteren Angaben.

**Du lieferst** `<button type="button" class="rs-textknopf">Was passiert</button>`. Der Text nennt die Aktion; während sie läuft, ist der Knopf `disabled` und eine Statuszeile mit `aria-live="polite"` sagt, was gerade geschieht. Die Trefferfläche ist über ein Pseudo-Element auf 44px erweitert.

**Nicht** für Navigation zu anderen Seiten (dafür Links) und nicht für die Hauptaktion einer Seite.
