// utils.js - Validation, Sanitization, Toast, Network Helpers

// ============================================
// SANITIZATION & XSS PREVENTION
// ============================================
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// VALIDATION RULES
// ============================================
export function validateUsername(username) {
  const pattern = /^[a-zA-Z0-9_]+#\d{4}$/;
  if (!pattern.test(username)) {
    return { valid: false, message: 'Format Username: Name#1234 (4 digit di akhir)' };
  }
  return { valid: true };
}

export function validateWhatsApp(number, countryDial) {
  const clean = number.replace(/\D/g, '');
  if (!clean || clean.length < 7 || clean.length > 15) {
    return { valid: false, message: 'Nomor WhatsApp tidak valid (7-15 digit)' };
  }
  // Hilangkan leading 0 jika ada setelah kode negara (opsional, untuk +62, +44, dll)
  let normalized = clean;
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  return { valid: true, normalized: `${countryDial}${normalized}` };
}

export function validateRequired(value, fieldName) {
  const clean = sanitizeInput(value);
  if (!clean) {
    return { valid: false, message: `${fieldName} wajib diisi` };
  }
  return { valid: true, value: clean };
}

export function validateEngine(engine) {
  const allowed = ['ProDrift', 'SR', '2JZ', 'V6TT', 'V8S', 'V8na'];
  if (!allowed.includes(engine)) {
    return { valid: false, message: 'Pilih engine yang valid' };
  }
  return { valid: true };
}

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
toastContainer.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
document.body.appendChild(toastContainer);

export function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-500/90 border-emerald-400 text-white',
    error: 'bg-red-600/90 border-red-400 text-white',
    warning: 'bg-amber-500/90 border-amber-400 text-white',
    info: 'bg-surface-container-high/95 border-primary/50 text-on-surface'
  };
  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg transform translate-x-full transition-all duration-300 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px]">${icons[type] || icons.info}</span>
    <span class="text-sm font-medium">${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full');
  });

  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// DEBOUNCE & THROTTLE
// ============================================
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, limit = 1000) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// NETWORK & RETRY HELPERS
// ============================================
export function isOnline() {
  return navigator.onLine;
}

export function watchNetwork(callback) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}

export async function withRetry(asyncFn, maxRetries = 3, delay = 1000, timeout = 10000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        asyncFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]);
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delay * attempt));
      }
    }
  }
  throw lastError;
}

// ============================================
// DATE FORMATTER
// ============================================
export function formatTimestamp(ts) {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

export function formatDateOnly(ts) {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

// ============================================
// SPAM PROTECTION
// ============================================
export class SubmitLock {
  constructor() {
    this.locked = false;
  }
  lock() {
    this.locked = true;
  }
  unlock() {
    this.locked = false;
  }
  isLocked() {
    return this.locked;
  }
}
