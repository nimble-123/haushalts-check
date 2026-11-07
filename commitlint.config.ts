import type { UserConfig } from '@commitlint/types';

// Conventional Commits (https://www.conventionalcommits.org/de/v1.0.0/): Typ auf Englisch, Beschreibung auf Deutsch.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Deutsche Substantive stehen groß, auch am Anfang der Beschreibung
    'subject-case': [0],
  },
} satisfies UserConfig;
