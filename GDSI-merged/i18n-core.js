/* ============================================================
   GDSI i18n Core — shared across all pages
   Each page defines window.GDSI_I18N_DICT = { id: {...}, en: {...} }
   BEFORE loading this script. Language choice is stored in
   localStorage under "gdsi_lang" so every page (same origin)
   stays in sync automatically. The switch UI itself only lives
   on index.html — other pages just read + apply the saved value.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'gdsi_lang';
  var DEFAULT_LANG = 'id';

  function getSavedLang() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return (v === 'id' || v === 'en') ? v : null;
    } catch (e) {
      return null;
    }
  }

  function getLang() {
    return getSavedLang() || DEFAULT_LANG;
  }

  function translate(lang) {
    var dict = window.GDSI_I18N_DICT;
    if (!dict || !dict[lang]) return;
    var table = dict[lang];

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (table[key] !== undefined) el.textContent = table[key];
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (table[key] !== undefined) el.innerHTML = table[key];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (table[key] !== undefined) el.setAttribute('placeholder', table[key]);
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      if (table[key] !== undefined) el.setAttribute('aria-label', table[key]);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (table[key] !== undefined) el.setAttribute('title', table[key]);
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-alt');
      if (table[key] !== undefined) el.setAttribute('alt', table[key]);
    });

    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-gdsi-lang', lang);

    document.querySelectorAll('[data-i18n-active-lang]').forEach(function (el) {
      el.classList.toggle('lang-active', el.getAttribute('data-i18n-active-lang') === lang);
    });
  }

  function setLang(lang) {
    if (lang !== 'id' && lang !== 'en') return;
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    translate(lang);
    window.dispatchEvent(new CustomEvent('gdsi:langchange', { detail: { lang: lang } }));
  }

  window.GDSI_I18N = { getLang: getLang, setLang: setLang, translate: translate };

  // Apply as soon as this script runs (placed at the end of <body>,
  // after content + the page dictionary, so there's minimal flash).
  translate(getLang());
})();
