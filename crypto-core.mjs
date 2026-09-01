const ENCODER = new TextEncoder();
const DECODER = new TextDecoder('utf-8', { fatal: true });
const PROTOCOL = 'offline-secure-session';
const MESSAGE_KIND = 'offline-secure-message';
const VERSION = 2;
const CURVE = 'P-256';
const VERIFY_INFO = ENCODER.encode(`${PROTOCOL}:v${VERSION}:verify`);
const MESSAGE_KEY_INFO = ENCODER.encode(`${PROTOCOL}:v${VERSION}:message-key`);

function subtle() {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持 Web Crypto');
  return globalThis.crypto.subtle;
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('编码内容为空');
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('编码内容格式错误');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary');
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    throw new Error('编码内容格式错误');
  }
}

function encodeJson(value) {
  return bytesToBase64Url(ENCODER.encode(JSON.stringify(value)));
}

function decodeJson(value) {
  try {
    return JSON.parse(DECODER.decode(base64UrlToBytes(value)));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) throw new Error('连接码格式错误');
    throw error;
  }
}

async function sha256(bytes) {
  return new Uint8Array(await subtle().digest('SHA-256', bytes));
}

function makeConnectionBundle(spki, nonce) {
  return {
    v: VERSION,
    kind: PROTOCOL,
    curve: CURVE,
    pub: bytesToBase64Url(spki),
    nonce: bytesToBase64Url(nonce),
  };
}

function validateConnectionBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('连接码格式错误');
  if (bundle.v !== VERSION || bundle.kind !== PROTOCOL || bundle.curve !== CURVE) throw new Error('连接码版本或类型不匹配');
  const publicBytes = base64UrlToBytes(bundle.pub);
  const nonce = base64UrlToBytes(bundle.nonce);
  if (publicBytes.length < 80 || publicBytes.length > 200) throw new Error('连接码中的公开信息长度异常');
  if (nonce.length !== 16) throw new Error('连接码中的随机信息长度异常');
  return { bundle, publicBytes, nonce };
}

export function parseConnectionCode(code) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('连接码为空');
  const trimmed = code.trim();
  if (!trimmed.startsWith('OSC2.')) throw new Error('这不是本工具生成的连接码');
  return validateConnectionBundle(decodeJson(trimmed.slice(5)));
}

export async function createIdentity() {
  const pair = await subtle().generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    false,
    ['deriveBits'],
  );
  const spki = new Uint8Array(await subtle().exportKey('spki', pair.publicKey));
  const nonce = randomBytes(16);
  const bundle = makeConnectionBundle(spki, nonce);
  const connectionCode = `OSC2.${encodeJson(bundle)}`;
  const publicDigest = await sha256(spki);
  const publicId = bytesToBase64Url(publicDigest.subarray(0, 6));
  publicDigest.fill(0);
  nonce.fill(0);
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicBytes: spki,
    connectionCode,
    publicId,
  };
}

function formatVerificationCode(bytes) {
  const groups = [];
  for (let i = 0; i < 6; i += 2) {
    const value = ((bytes[i] << 8) | bytes[i + 1]) % 10000;
    groups.push(String(value).padStart(4, '0'));
  }
  return groups.join(' ');
}

export async function deriveSession(identity, peerConnectionCode) {
  if (!identity?.privateKey || !identity?.connectionCode) throw new Error('本机连接身份不存在');
  const peer = parseConnectionCode(peerConnectionCode);
  if (peerConnectionCode.trim() === identity.connectionCode) throw new Error('不能和自己的连接码建立连接');

  const peerPublicKey = await subtle().importKey(
    'spki',
    peer.publicBytes,
    { name: 'ECDH', namedCurve: CURVE },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(await subtle().deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    identity.privateKey,
    256,
  ));

  const codes = [identity.connectionCode, peerConnectionCode.trim()].sort();
  const transcript = ENCODER.encode(`${PROTOCOL}:v${VERSION}\n${codes[0]}\n${codes[1]}`);
  const transcriptHash = await sha256(transcript);
  const hkdfBase = await subtle().importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey', 'deriveBits']);

  try {
    const [messageKey, verifyBits] = await Promise.all([
      subtle().deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: transcriptHash, info: MESSAGE_KEY_INFO },
        hkdfBase,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      ),
      subtle().deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: transcriptHash, info: VERIFY_INFO },
        hkdfBase,
        48,
      ),
    ]);

    const verifyBytes = new Uint8Array(verifyBits);
    const sessionId = bytesToBase64Url(transcriptHash.subarray(0, 12));
    const verificationCode = formatVerificationCode(verifyBytes);
    verifyBytes.fill(0);

    return {
      key: messageKey,
      sessionId,
      verificationCode,
      peerPublicId: bytesToBase64Url((await sha256(peer.publicBytes)).subarray(0, 6)),
    };
  } finally {
    sharedSecret.fill(0);
    transcript.fill(0);
    transcriptHash.fill(0);
    peer.publicBytes.fill(0);
    peer.nonce.fill(0);
  }
}

function validateMessageEnvelope(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('密文格式错误');
  if (obj.v !== VERSION || obj.kind !== MESSAGE_KIND) throw new Error('密文版本或类型不匹配');
  for (const field of ['sid', 'mid', 'iv', 'data']) {
    if (typeof obj[field] !== 'string' || obj[field].length === 0) throw new Error(`密文缺少字段：${field}`);
  }
  return obj;
}

export function inspectMessage(envelopeText) {
  if (typeof envelopeText !== 'string' || !envelopeText.trim()) throw new Error('密文为空');
  let obj;
  try {
    obj = JSON.parse(envelopeText);
  } catch {
    throw new Error('密文格式错误');
  }
  return validateMessageEnvelope(obj);
}

export async function encryptSessionMessage(session, plaintext) {
  if (!session?.key || !session?.sessionId) throw new Error('尚未建立共享会话');
  if (typeof plaintext !== 'string') throw new Error('消息必须是文本');
  const iv = randomBytes(12);
  const messageId = bytesToBase64Url(randomBytes(16));
  const aad = ENCODER.encode(`${MESSAGE_KIND}|${VERSION}|${session.sessionId}|${messageId}`);
  const plainBytes = ENCODER.encode(plaintext);
  try {
    const ciphertext = new Uint8Array(await subtle().encrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
      session.key,
      plainBytes,
    ));
    return JSON.stringify({
      v: VERSION,
      kind: MESSAGE_KIND,
      sid: session.sessionId,
      mid: messageId,
      iv: bytesToBase64Url(iv),
      data: bytesToBase64Url(ciphertext),
    });
  } finally {
    iv.fill(0);
    aad.fill(0);
    plainBytes.fill(0);
  }
}

export async function decryptSessionMessage(session, envelopeText) {
  if (!session?.key || !session?.sessionId) throw new Error('尚未建立共享会话');
  const envelope = inspectMessage(envelopeText);
  if (envelope.sid !== session.sessionId) throw new Error('这条密文不属于当前连接');
  const iv = base64UrlToBytes(envelope.iv);
  const ciphertext = base64UrlToBytes(envelope.data);
  if (iv.length !== 12) throw new Error('密文随机参数长度异常');
  const aad = ENCODER.encode(`${MESSAGE_KIND}|${VERSION}|${session.sessionId}|${envelope.mid}`);
  let plaintextBytes;
  try {
    plaintextBytes = new Uint8Array(await subtle().decrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
      session.key,
      ciphertext,
    ));
    return { plaintext: DECODER.decode(plaintextBytes), messageId: envelope.mid };
  } catch (error) {
    if (error instanceof DOMException) throw new Error('密文已损坏、被修改，或共享密钥不匹配');
    throw error;
  } finally {
    iv.fill(0);
    ciphertext.fill(0);
    aad.fill(0);
    plaintextBytes?.fill(0);
  }
}
