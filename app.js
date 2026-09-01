const $ = (id) => document.getElementById(id);
const MAX_TEXT_CHARS = 10_000_000;
const IDLE_MS = 10 * 60 * 1000;

let worker;
let requestId = 0;
let pending = new Map();
let idleTimer;
let toastTimer;
let state = {
  connectionCode: '',
  connected: false,
  verified: false,
  verificationCode: '',
};

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
    setStatus('本机计算出现问题，请刷新页面后再试', true);
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

function showToast(message, error = false) {
  clearTimeout(toastTimer);
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.textContent = message;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 3600);
}

function setBusy(button, busy, busyText) {
  if (!button.dataset.normalText) button.dataset.normalText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.normalText;
}

function baseConnectionStatus() {
  if (state.verified) return '安全连接已建立，可以发送和打开消息';
  if (state.connected) return '等待双方核对数字';
  return '等待建立连接';
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

function renderState(nextState) {
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
    $('connectionStatusTitle').textContent = '安全连接已建立';
    $('connectionStatusText').textContent = '核对完成。当前页面已经持有双方共同的会话钥匙。';
    setStatus('安全连接已建立，可以发送和打开消息');
  } else if (state.connected) {
    $('connectionStatusTitle').textContent = '已经算出共同会话钥匙，等待核对';
    $('connectionStatusText').textContent = '在核对数字完成之前，页面不会允许加密或解密消息。';
    setStatus('等待双方核对数字');
  } else {
    $('connectionStatusTitle').textContent = '还没有连接';
    $('connectionStatusText').textContent = '先把你的连接码发给对方，再粘贴对方的连接码。';
    setStatus('等待建立连接');
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
  $('plainCount').textContent = '0 字符';
}

async function resetEverything({ notify = true } = {}) {
  clearMessageFields();
  createWorker();
  $('myConnectionCode').value = '';
  $('verificationCode').textContent = '----';
  try {
    const initial = await rpc('init');
    renderState(initial);
    if (notify) showToast('当前连接已经结束，新的本机连接码已生成');
  } catch {
    setStatus('无法生成本机连接信息，请刷新页面', true);
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
  if (!value) return showToast('没有可复制的内容', true);
  try {
    await navigator.clipboard.writeText(value);
    showToast('已复制');
  } catch {
    const el = $(id);
    el.focus();
    el.select();
    showToast('无法自动复制，文字已经选中，请手动复制', true);
  }
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', () => copyFrom(button.dataset.copy));
}

$('plaintext').addEventListener('input', () => {
  $('plainCount').textContent = `${$('plaintext').value.length.toLocaleString()} 字符`;
});

$('peerConnectionCode').addEventListener('input', () => {
  if (!$('peerConnectionError').hidden) setPeerConnectionError();
});

$('connectBtn').addEventListener('click', async () => {
  const button = $('connectBtn');
  const peerConnectionCode = $('peerConnectionCode').value.trim();
  if (!peerConnectionCode) {
    const message = '请先粘贴对方的完整连接码。';
    setPeerConnectionError(message);
    $('peerConnectionCode').focus();
    return;
  }
  if (!peerConnectionCode.startsWith('OSC2.')) {
    const message = '连接码格式不正确。请重新粘贴以 OSC2. 开头的完整连接码。';
    setPeerConnectionError(message);
    setStatus(baseConnectionStatus());
    $('peerConnectionCode').focus();
    return;
  }
  setPeerConnectionError();
  setBusy(button, true, '正在计算共同钥匙…');
  setStatus('正在使用双方的连接信息计算共同会话钥匙…');
  try {
    const nextState = await rpc('connect', { peerConnectionCode });
    renderState(nextState);
    $('verifyStep').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('共同会话钥匙已经算出。现在必须和对方核对数字。');
  } catch (error) {
    const message = error.message.includes('自己的连接码')
      ? '这是你自己的连接码。请粘贴对方页面上的连接码。'
      : '无法识别这段连接码。请让对方重新完整复制。';
    setPeerConnectionError(message);
    setStatus(baseConnectionStatus());
    $('peerConnectionCode').focus();
  } finally {
    setBusy(button, false);
  }
});

$('verifyBtn').addEventListener('click', async () => {
  const button = $('verifyBtn');
  setBusy(button, true, '正在确认…');
  try {
    const nextState = await rpc('verify');
    renderState(nextState);
    showToast('核对完成。现在双方可以使用这次连接交换秘密消息。');
  } catch {
    showToast('当前连接状态不正确，请重新建立连接', true);
  } finally {
    setBusy(button, false);
  }
});

$('goSendBtn').addEventListener('click', () => switchTab('send'));

$('newConnectionBtn').addEventListener('click', async () => {
  const button = $('newConnectionBtn');
  setBusy(button, true, '正在重新开始…');
  clearMessageFields();
  try {
    const nextState = await rpc('reset');
    renderState(nextState);
    switchTab('connect');
    showToast('已生成新的连接码，旧会话钥匙已经丢弃');
  } catch {
    showToast('重新开始失败，请刷新页面', true);
  } finally {
    setBusy(button, false);
  }
});

$('encryptBtn').addEventListener('click', async () => {
  const button = $('encryptBtn');
  const plaintext = $('plaintext').value;
  if (!state.verified) return showToast('请先完成安全连接和数字核对', true);
  if (!plaintext) return showToast('请先输入要发送的消息', true);
  if (plaintext.length > MAX_TEXT_CHARS) return showToast('消息过大，请分成几条发送', true);
  setBusy(button, true, '正在生成密文…');
  setStatus('正在使用当前会话钥匙加密…');
  try {
    $('ciphertext').value = await rpc('encrypt', { plaintext });
    setStatus('密文已生成');
    showToast('完成。把下面的密文完整发给对方。');
  } catch {
    showToast('无法生成密文，请重新建立连接后再试', true);
    setStatus('加密失败', true);
  } finally {
    setBusy(button, false);
  }
});

$('decryptBtn').addEventListener('click', async () => {
  const button = $('decryptBtn');
  const envelope = $('receivedCiphertext').value.trim();
  if (!state.verified) return showToast('请先完成安全连接和数字核对', true);
  if (!envelope) return showToast('请先粘贴对方发来的密文', true);
  if (envelope.length > MAX_TEXT_CHARS * 2) return showToast('密文过大，请确认复制内容是否正确', true);
  setBusy(button, true, '正在打开…');
  setStatus('正在使用当前会话钥匙验证并打开消息…');
  try {
    $('decryptedText').value = await rpc('decrypt', { envelope });
    setStatus('消息已打开');
    showToast('消息已经安全打开');
  } catch (error) {
    $('decryptedText').value = '';
    let message = '打不开这条消息。它可能来自其他连接，或者内容被修改了。';
    if (error.message.includes('已经打开过')) message = '这条密文已经在当前页面打开过一次。';
    if (error.message.includes('不属于当前连接')) message = '这条密文不是当前安全连接生成的。';
    showToast(message, true);
    setStatus(message, true);
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
  setStatus('这个浏览器太旧，无法运行此工具。请换用较新的浏览器。', true);
} else {
  createWorker();
  rpc('init')
    .then((initial) => {
      renderState(initial);
      resetIdleTimer();
    })
    .catch(() => setStatus('无法生成本机连接信息，请刷新页面', true));
}
