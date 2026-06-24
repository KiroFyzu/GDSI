/* ============================================================
   GDSI Theme Core — runs in <head> BEFORE any content renders.
   Sets both dark/light AND lang attribute immediately so:
   1. No flash of wrong theme (dark blinks to light or vice versa)
   2. No flash of mixed language (both ID+EN visible briefly)
   ============================================================ */
(function () {
  'use strict';

  // ── 1. LANGUAGE — set data-gdsi-lang NOW ──────────────────
  var lang = 'id';
  try {
    var saved = window.localStorage.getItem('gdsi_lang');
    if (saved === 'id' || saved === 'en') lang = saved;
  } catch (e) {}
  document.documentElement.setAttribute('data-gdsi-lang', lang);
  document.documentElement.setAttribute('lang', lang);

  // ── 2. DARK / LIGHT — set .dark class NOW ─────────────────
  function isDarkHour(d) {
    var h = d.getHours();
    return h < 6 || h >= 18;
  }

  function applyTheme() {
    var dark = isDarkHour(new Date());
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-gdsi-theme', dark ? 'dark' : 'light');
  }

  applyTheme();

  // Re-check every minute so open tabs flip at 06:00 / 18:00.
  window.GDSI_THEME = { recheck: applyTheme };
  setInterval(applyTheme, 60 * 1000);
})();
