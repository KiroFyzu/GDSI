// ui.js - UI Logic, Modals, Form States, Country Dropdown
import { COUNTRIES } from './countries.js';
import { escapeHtml, formatTimestamp } from './utils.js';

// ============================================
// DOM REFERENCES
// ============================================
const els = {
  form: () => document.getElementById('registration-form'),
  submitBtn: () => document.getElementById('submit-btn'),
  submitText: () => document.getElementById('submit-text'),
  submitSpinner: () => document.getElementById('submit-spinner'),
  viewDataBtn: () => document.getElementById('view-data-btn'),
  closeBtn: () => document.getElementById('close-btn'),
  authOverlay: () => document.getElementById('auth-overlay'),
  profileName: () => document.getElementById('profile-name'),
  profileAvatar: () => document.getElementById('profile-avatar'),
  countrySelect: () => document.getElementById('country-select'),
  countrySearch: () => document.getElementById('country-search'),
  countryDropdown: () => document.getElementById('country-dropdown'),
  countryTrigger: () => document.getElementById('country-trigger'),
  countryDisplay: () => document.getElementById('country-display'),
  modalSuccess: () => document.getElementById('modal-success'),
  modalInfo: () => document.getElementById('modal-info'),
  modalBackdrop: () => document.querySelectorAll('.modal-backdrop'),
  readonlyBanner: () => document.getElementById('readonly-banner')
};

// ============================================
// COUNTRY DROPDOWN LOGIC
// ============================================
let selectedCountry = COUNTRIES.find(c => c.code === 'ID') || COUNTRIES[0];

export function initCountryDropdown() {
  const trigger = els.countryTrigger();
  const dropdown = els.countryDropdown();
  const search = els.countrySearch();
  const display = els.countryDisplay();

  if (!trigger || !dropdown) return;

  // Set default Indonesia
  updateCountryDisplay();

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
      search.focus();
      renderCountryList(COUNTRIES);
    }
  });

  search.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.dial.includes(term) ||
      c.code.toLowerCase().includes(term)
    );
    renderCountryList(filtered);
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

function renderCountryList(list) {
  const container = els.countryDropdown();
  if (!container) return;
  container.innerHTML = '';

  list.forEach(country => {
    const item = document.createElement('div');
    item.className = 'px-3 py-2 hover:bg-surface-bright/50 cursor-pointer flex items-center gap-2 text-sm text-on-surface transition-colors';
    item.innerHTML = `
      <span class="font-medium w-8 text-right text-on-surface-variant">${country.dial}</span>
      <span>${escapeHtml(country.name)}</span>
    `;
    item.addEventListener('click', () => {
      selectedCountry = country;
      updateCountryDisplay();
      container.classList.add('hidden');
    });
    container.appendChild(item);
  });

  if (list.length === 0) {
    container.innerHTML = '<div class="px-3 py-2 text-sm text-on-surface-variant">Tidak ditemukan</div>';
  }
}

function updateCountryDisplay() {
  const display = els.countryDisplay();
  if (display) {
    display.textContent = selectedCountry.dial;
    display.dataset.dial = selectedCountry.dial;
  }
}

export function getSelectedCountryDial() {
  return selectedCountry.dial;
}

// ============================================
// FORM MODE MANAGEMENT
// ============================================
export function setFormMode(mode, data = null) {
  const form = els.form();
  const submitBtn = els.submitBtn();
  const viewBtn = els.viewDataBtn();
  const closeBtn = els.closeBtn();
  const readonlyBanner = els.readonlyBanner();

  if (!form) return;

  const inputs = form.querySelectorAll('input, select');

  if (mode === 'readonly' && data) {
    // Populate and lock
    populateForm(data);
    inputs.forEach(input => {
      input.setAttribute('readonly', 'true');
      input.setAttribute('disabled', 'true');
      input.classList.add('opacity-60', 'cursor-not-allowed');
    });
    if (submitBtn) submitBtn.classList.add('hidden');
    if (readonlyBanner) readonlyBanner.classList.remove('hidden');
    if (viewBtn) {
      viewBtn.classList.remove('hidden');
      viewBtn.onclick = () => showInfoModal(data);
    }
    if (closeBtn) closeBtn.classList.remove('hidden');
  } else if (mode === 'editable') {
    inputs.forEach(input => {
      input.removeAttribute('readonly');
      input.removeAttribute('disabled');
      input.classList.remove('opacity-60', 'cursor-not-allowed');
    });
    if (submitBtn) {
      submitBtn.classList.remove('hidden');
      submitBtn.disabled = false;
    }
    if (readonlyBanner) readonlyBanner.classList.add('hidden');
    if (viewBtn) viewBtn.classList.add('hidden');
    if (closeBtn) closeBtn.classList.add('hidden');
  } else if (mode === 'locked') {
    // Not authenticated
    inputs.forEach(input => input.setAttribute('disabled', 'true'));
    if (submitBtn) submitBtn.classList.add('hidden');
    if (readonlyBanner) readonlyBanner.classList.add('hidden');
  }
}

function populateForm(data) {
  const form = els.form();
  if (!form) return;

  const fields = {
    'full-name': data.name,
    'whatsapp-number': data.whatsapp,
    'username-id': data.usernameId,
    'club-team': data.clubTeam,
    'car': data.car,
    'engine': data.engine
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = form.querySelector(`[name="${id}"]`);
    if (el) el.value = value || '';
  });

  // Engine select
  const engineSelect = form.querySelector('[name="engine"]');
  if (engineSelect && data.engine) {
    engineSelect.value = data.engine;
  }
}

// ============================================
// PROFILE BAR
// ============================================
export function updateProfileBar(user) {
  const nameEl = els.profileName();
  const avatarEl = els.profileAvatar();

  if (nameEl) nameEl.textContent = user.displayName || user.email || 'Racer';
  if (avatarEl) {
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${escapeHtml(user.photoURL)}" class="w-full h-full object-cover" alt="avatar">`;
    } else {
      avatarEl.innerHTML = '<span class="material-symbols-outlined text-primary text-[20px]">person</span>';
    }
  }
}

// ============================================
// AUTH OVERLAY
// ============================================
export function showAuthOverlay() {
  const overlay = els.authOverlay();
  if (overlay) overlay.classList.remove('hidden');
}

export function hideAuthOverlay() {
  const overlay = els.authOverlay();
  if (overlay) overlay.classList.add('hidden');
}

// ============================================
// LOADING STATE
// ============================================
export function setSubmitLoading(isLoading) {
  const btn = els.submitBtn();
  const text = els.submitText();
  const spinner = els.submitSpinner();

  if (!btn) return;

  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('opacity-80', 'cursor-wait');
    if (text) text.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
  } else {
    btn.disabled = false;
    btn.classList.remove('opacity-80', 'cursor-wait');
    if (text) text.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
  }
}

// ============================================
// MODALS
// ============================================
export function showSuccessModal(data) {
  const modal = els.modalSuccess();
  if (!modal) return;

  const fields = {
    'modal-name': data.name,
    'modal-username': data.usernameId,
    'modal-team': data.clubTeam,
    'modal-car': data.car,
    'modal-engine': data.engine,
    'modal-timestamp': formatTimestamp(data.registeredAt)
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = modal.querySelector(`[data-field="${id}"]`);
    if (el) el.textContent = value || '-';
  });

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function showInfoModal(data) {
  const modal = els.modalInfo();
  if (!modal) return;

  const fields = {
    'info-name': data.name,
    'info-email': data.email,
    'info-username': data.usernameId,
    'info-car': data.car,
    'info-engine': data.engine,
    'info-date': formatTimestamp(data.registeredAt)
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = modal.querySelector(`[data-field="${id}"]`);
    if (el) el.textContent = value || '-';
  });

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  document.body.style.overflow = '';
}

// Init modal close buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });
});
