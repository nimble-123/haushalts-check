// Läuft vor dem ersten Zeichnen (inline im <head>), damit eine gespeicherte Theme-Wahl nicht aufblitzt.
// Der Text wird für die Content-Security-Policy gehasht (astro.config.ts): bei Änderungen nichts weiter tun.
export const THEMA_START =
  "try{var t=localStorage.getItem('haushalts-check-thema');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";
