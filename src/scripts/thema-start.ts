// Läuft vor dem ersten Zeichnen (inline im <head>), damit eine gespeicherte Theme-Wahl nicht aufblitzt.
// Der Text wird für die Content-Security-Policy gehasht (astro.config.ts): bei Änderungen nichts weiter tun.
export const THEMA_KEY = 'haushalts-check-thema';
export const THEMA_START = `try{var t=localStorage.getItem('${THEMA_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
