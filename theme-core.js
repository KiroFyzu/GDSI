/* GDSI Core — lang detection only, no dark mode */
(function () {
  'use strict';
  var lang = 'id';
  try {
    var saved = window.localStorage.getItem('gdsi_lang');
    if (saved === 'id' || saved === 'en') lang = saved;
  } catch (e) {}
  document.documentElement.setAttribute('data-gdsi-lang', lang);
  document.documentElement.setAttribute('lang', lang);
})();
