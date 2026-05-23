// ui.js - UI Logic, Modals, Form States, Country Modal
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
  countryModal: () => document.getElementById('country-modal'),
  countryModalClose: () => document.getElementById('country-modal-close'),
  countryTrigger: () => document.getElementById('country-trigger'),
  countryDisplay: () => document.getElementById('country-display'),
  countryList: () => document.getElementById('country-list'),
  modalSuccess: () => document.getElementById('modal-success'),
  modalInfo: () => document.getElementById('modal-info'),
  readonlyBanner: () => document.getElementById('readonly-banner')
};

// ============================================
// COUNTRY MODAL - POPUP STYLE, NO SEARCH
// ============================================
let selectedCountry = COUNTRIES.find(c => c.code === 'ID') || COUNTRIES[0];
let isCountryModalOpen = false;

// Helper: get flag emoji from country code
function getFlagEmoji(countryCode) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function initCountryDropdown() {
  const trigger = els.countryTrigger();
  const modal = els.countryModal();
  const closeBtn = els.countryModalClose();

  if (!trigger || !modal) return;

  // Set default Indonesia
  updateCountryDisplay();
  // Pre-render list
  renderCountryList(COUNTRIES);

  // Open modal on trigger click
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCountryModal();
  });

  // Close modal on close button
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCountryModal();
    });
  }

  // Close modal when clicking backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCountryModal();
    }
  });

  // Close modal with ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isCountryModalOpen) {
      closeCountryModal();
    }
  });
}

function openCountryModal() {
  const modal = els.countryModal();
  if (!modal) return;

  modal.classList.remove('hidden');
  isCountryModalOpen = true;
  document.body.style.overflow = 'hidden';

  // Scroll to selected country
  const selectedEl = modal.querySelector('.country-item.selected');
  if (selectedEl) {
    selectedEl.scrollIntoView({ behavior: 'instant', block: 'center' });
  }
}

function closeCountryModal() {
  const modal = els.countryModal();
  if (!modal) return;

  modal.classList.add('hidden');
  isCountryModalOpen = false;
  document.body.style.overflow = '';
}

function renderCountryList(list) {
  const container = els.countryList();
  if (!container) return;
  container.innerHTML = '';

  list.forEach(country => {
    const item = document.createElement('div');
    const isSelected = selectedCountry && selectedCountry.code === country.code;
    item.className = 'country-item' + (isSelected ? ' selected' : '');
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

    const flag = getFlagEmoji(country.code);

    item.innerHTML = `
      <span class="country-flag">${flag}</span>
      <span class="country-name">${escapeHtml(country.name)}</span>
      <span class="country-dial">${escapeHtml(country.dial)}</span>
    `;

    // Click to select
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      selectedCountry = country;
      updateCountryDisplay();
      closeCountryModal();
    });

    // Keyboard support
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        selectedCountry = country;
        updateCountryDisplay();
        closeCountryModal();
      }
    });

    container.appendChild(item);
  });
}

function updateCountryDisplay() {
  const display = els.countryDisplay();
  if (display) {
    display.textContent = selectedCountry.dial;
    display.dataset.dial = selectedCountry.dial;
    display.dataset.code = selectedCountry.code;
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