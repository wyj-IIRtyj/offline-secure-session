import { TRANSLATIONS } from './i18n.js';

const $ = (id) => document.getElementById(id);
const MAX_TEXT_CHARS = 10_000_000;
const IDLE_MS = 10 * 60 * 1000;

let worker;
let requestId = 0;
let pending = new Map();
let idleTimer;
let toastTimer;
let currentLang = 'zh';

let state = {
  connectionCode: '',
  connected: false,
  verified: false,
  verificationCode: '',
};

function getInitialLang() {
  try {
    const saved = localStorage.getItem('preferred_lang');
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch {}
  const navLang = (navigator.language || '').toLowerCase();
  if (navLang.startsWith('ja')) return 'ja';
  if (navLang.startsWith('zh')) return 'zh';
  return 'en';
}

function t(key, vars = {}) {
  let text = TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.zh[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  try {
    localStorage.setItem('preferred_lang', lang);
  } catch {}
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  document.title = t('meta_title');

  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  }

  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.dataset.i18nHtml);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }

  updatePlainCount();
  renderState();
}

function createWorker() {
  worker?.terminate();
  for (const { reject } of pending.values()) reject(new Error('本机计算已重置'));
  pending = new Map();
  worker = new Worker('./crypto-worker.mjs', { type: 'module' });
  worker.onmessage = ({ data }) => {
    const item = pending.get(data?.id);
    if (!item) return;
    pending.delete(data.id);
    if (data.ok) item.resolve(data.result);
    else item.reject(new Error(data.error || '操作失败'));
  };
  worker.onerror = () => {
    for (const { reject } of pending.values()) reject(new Error('本机计算出现问题'));
    pending.clear();
    setStatus(t('runtime_init_failed'), true);
  };
}

function rpc(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, action, payload });
  });
}

function setStatus(message, error = false) {
  const el = $('runtimeStatus');
  el.textContent = message;
  el.style.fontWeight = error ? '800' : '';
}

function setPeerConnectionError(message = '') {
  const el = $('peerConnectionError');
  el.textContent = message;
  el.hidden = !message;
  $('peerConnectionCode').setAttribute('aria-invalid', message ? 'true' : 'false');
}

function showToast(messageKeyOrText, error = false, isKey = true) {
  const message = isKey ? t(messageKeyOrText) : messageKeyOrText;
  clearTimeout(toastTimer);
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.textContent = message;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 3600);
}

function setBusy(button, busy, busyTextKey) {
  if (busy) {
    if (!button.dataset.normalKey) {
      button.dataset.normalKey = button.dataset.i18n || '';
    }
    button.disabled = true;
    button.textContent = t(busyTextKey);
  } else {
    button.disabled = false;
    if (button.dataset.normalKey) {
      button.textContent = t(button.dataset.normalKey);
    }
  }
}

function baseConnectionStatus() {
  if (state.verified) return t('runtime_ready');
  if (state.connected) return t('runtime_waiting_verify');
  return t('runtime_waiting_connect');
}

function switchTab(target) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.tab === target);
  }
  for (const panel of document.querySelectorAll('[data-panel]')) {
    const active = panel.dataset.panel === target;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  }
  setStatus(baseConnectionStatus());
  resetIdleTimer();
}

function renderState(nextState = {}) {
  state = { ...state, ...nextState };
  setPeerConnectionError();
  if (state.connectionCode) $('myConnectionCode').value = state.connectionCode;

  const waitingVerify = state.connected && !state.verified;
  $('verifyStep').hidden = !waitingVerify;
  $('connectedStep').hidden = !state.verified;
  $('verificationCode').textContent = waitingVerify ? state.verificationCode : '----';

  const box = $('connectionStatusBox');
  box.classList.toggle('connected', state.verified);
  if (state.verified) {
    $('connectionStatusTitle').textContent = t('status_connected_title');
    $('connectionStatusText').textContent = t('status_connected_desc');
    setStatus(t('runtime_ready'));
  } else if (state.connected) {
    $('connectionStatusTitle').textContent = t('status_waiting_verify_title');
    $('connectionStatusText').textContent = t('status_waiting_verify_desc');
    setStatus(t('runtime_waiting_verify'));
  } else {
    $('connectionStatusTitle').textContent = t('status_not_connected_title');
    $('connectionStatusText').textContent = t('status_not_connected_desc');
    setStatus(t('runtime_waiting_connect'));
  }

  $('sendGuard').hidden = state.verified;
  $('receiveGuard').hidden = state.verified;
  $('sendContent').hidden = !state.verified;
  $('receiveContent').hidden = !state.verified;
}

function clearMessageFields() {
  for (const id of ['peerConnectionCode', 'plaintext', 'ciphertext', 'receivedCiphertext', 'decryptedText']) {
    $(id).value = '';
  }
  updatePlainCount();
}

function updatePlainCount() {
  const len = $('plaintext')?.value?.length ?? 0;
  $('plainCount').textContent = t('plain_count', { count: len.toLocaleString() });
}

async function resetEverything({ notify = true } = {}) {
  clearMessageFields();
  createWorker();
  $('myConnectionCode').value = '';
  $('verificationCode').textContent = '----';
  try {
    const initial = await rpc('init');
    renderState(initial);
    if (notify) showToast('toast_reset_done');
  } catch {
    setStatus(t('runtime_init_failed'), true);
  }
  resetIdleTimer();
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (!$('autoClear')?.checked) return;
  idleTimer = setTimeout(() => resetEverything(), IDLE_MS);
}

async function copyFrom(id) {
  const value = $(id)?.value ?? '';
  if (!value) return showToast('toast_no_copy_content', true);
  try {
    await navigator.clipboard.writeText(value);
    showToast('toast_copied');
  } catch {
    const el = $(id);
    el.focus();
    el.select();
    showToast('toast_manual_copy', true);
  }
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', () => copyFrom(button.dataset.copy));
}

for (const btn of document.querySelectorAll('.lang-btn')) {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
}

$('plaintext').addEventListener('input', updatePlainCount);

$('peerConnectionCode').addEventListener('input', () => {
  if (!$('peerConnectionError').hidden) setPeerConnectionError();
});

$('connectBtn').addEventListener('click', async () => {
  const button = $('connectBtn');
  const peerConnectionCode = $('peerConnectionCode').value.trim();
  if (!peerConnectionCode) {
    const message = t('err_empty_peer_code');
    setPeerConnectionError(message);
    $('peerConnectionCode').focus();
    return;
  }
  if (!peerConnectionCode.startsWith('OSC2.')) {
    const message = t('err_invalid_peer_code_prefix');
    setPeerConnectionError(message);
    setStatus(baseConnectionStatus());
    $('peerConnectionCode').focus();
    return;
  }
  setPeerConnectionError();
  setBusy(button, true, 'busy_calculating');
  setStatus(t('runtime_calc_shared'));
  try {
    const nextState = await rpc('connect', { peerConnectionCode });
    renderState(nextState);
    $('verifyStep').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('toast_shared_derived');
  } catch (error) {
    const message = error.message.includes('自己的连接码')
      ? t('err_self_peer_code')
      : t('err_unrecognized_peer_code');
    setPeerConnectionError(message);
    setStatus(baseConnectionStatus());
    $('peerConnectionCode').focus();
  } finally {
    setBusy(button, false);
  }
});

$('verifyBtn').addEventListener('click', async () => {
  const button = $('verifyBtn');
  setBusy(button, true, 'busy_verifying');
  try {
    const nextState = await rpc('verify');
    renderState(nextState);
    showToast('toast_verified');
  } catch {
    showToast('toast_verify_invalid_state', true);
  } finally {
    setBusy(button, false);
  }
});

$('goSendBtn').addEventListener('click', () => switchTab('send'));

$('newConnectionBtn').addEventListener('click', async () => {
  const button = $('newConnectionBtn');
  setBusy(button, true, 'busy_restarting');
  clearMessageFields();
  try {
    const nextState = await rpc('reset');
    renderState(nextState);
    switchTab('connect');
    showToast('toast_new_code_generated');
  } catch {
    showToast('toast_reset_failed', true);
  } finally {
    setBusy(button, false);
  }
});

$('encryptBtn').addEventListener('click', async () => {
  const button = $('encryptBtn');
  const plaintext = $('plaintext').value;
  if (!state.verified) return showToast('toast_need_verify', true);
  if (!plaintext) return showToast('toast_need_message', true);
  if (plaintext.length > MAX_TEXT_CHARS) return showToast('toast_message_too_large', true);
  setBusy(button, true, 'busy_encrypting');
  setStatus(t('runtime_encrypting'));
  try {
    $('ciphertext').value = await rpc('encrypt', { plaintext });
    setStatus(t('runtime_encrypted'));
    showToast('toast_ciphertext_ready');
  } catch {
    showToast('toast_encrypt_error', true);
    setStatus(t('runtime_encrypt_failed'), true);
  } finally {
    setBusy(button, false);
  }
});

$('decryptBtn').addEventListener('click', async () => {
  const button = $('decryptBtn');
  const envelope = $('receivedCiphertext').value.trim();
  if (!state.verified) return showToast('toast_need_verify', true);
  if (!envelope) return showToast('toast_need_ciphertext', true);
  if (envelope.length > MAX_TEXT_CHARS * 2) return showToast('toast_ciphertext_too_large', true);
  setBusy(button, true, 'busy_decrypting');
  setStatus(t('runtime_decrypting'));
  try {
    $('decryptedText').value = await rpc('decrypt', { envelope });
    setStatus(t('runtime_decrypted'));
    showToast('toast_decrypt_success');
  } catch (error) {
    $('decryptedText').value = '';
    let messageKey = 'toast_decrypt_failed';
    if (error.message.includes('已经打开过')) messageKey = 'toast_decrypt_replayed';
    if (error.message.includes('不属于当前连接')) messageKey = 'toast_decrypt_mismatched';
    showToast(messageKey, true);
    setStatus(t(messageKey), true);
  } finally {
    setBusy(button, false);
  }
});

$('clearAll').addEventListener('click', () => resetEverything());
$('autoClear').addEventListener('change', resetIdleTimer);
document.addEventListener('input', resetIdleTimer, { passive: true });
document.addEventListener('pointerdown', resetIdleTimer, { passive: true });
document.addEventListener('keydown', resetIdleTimer, { passive: true });
window.addEventListener('pagehide', () => {
  clearTimeout(idleTimer);
  worker?.terminate();
});

if (!globalThis.crypto?.subtle || !globalThis.Worker) {
  setStatus(t('runtime_old_browser'), true);
} else {
  // Initialize language first
  setLanguage(getInitialLang());
  createWorker();
  rpc('init')
    .then((initial) => {
      renderState(initial);
      resetIdleTimer();
    })
    .catch(() => setStatus(t('runtime_init_failed'), true));
}
