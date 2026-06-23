/* ============================================================
   GDSI Theme Core — auto dark/light based on device local time
   06:00–17:59 = light, 18:00–05:59 = dark.
   Re-checks every minute so an open tab flips live at the boundary.
   No manual toggle (by design — see project notes).
   ============================================================ */
(function () {
  'use strict';

  function isDarkHour(date) {
    var h = date.getHours();
    return h < 6 || h >= 18;
  }

  function apply() {
    var dark = isDarkHour(new Date());
    var root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-gdsi-theme', dark ? 'dark' : 'light');
  }

  // Apply immediately (this script is loaded as the very first thing in
  // <head>, before the Tailwind CDN script, so there's no flash).
  apply();

  // Keep checking in case the tab stays open across the 06:00/18:00 boundary.
  window.GDSI_THEME = { recheck: apply };
  setInterval(apply, 60 * 1000);
})();
