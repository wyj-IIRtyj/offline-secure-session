import {
  createIdentity,
  decryptSessionMessage,
  deriveSession,
  encryptSessionMessage,
  inspectMessage,
} from './crypto-core.mjs';

export function createSessionController() {
  let identity = null;
  let session = null;
  let verified = false;
  let seenMessageIds = new Set();

  async function ensureIdentity() {
    if (!identity) identity = await createIdentity();
    return identity;
  }

  function publicState() {
    return {
      connectionCode: identity?.connectionCode ?? '',
      publicId: identity?.publicId ?? '',
      connected: Boolean(session),
      verified,
      sessionId: session?.sessionId ?? '',
      verificationCode: session?.verificationCode ?? '',
    };
  }

  async function resetAll() {
    identity = await createIdentity();
    session = null;
    verified = false;
    seenMessageIds = new Set();
    return publicState();
  }

  return {
    async handle(action, payload = {}) {
      switch (action) {
        case 'init':
          await ensureIdentity();
          return publicState();
        case 'reset':
          return resetAll();
        case 'connect': {
          await ensureIdentity();
          session = await deriveSession(identity, payload.peerConnectionCode ?? '');
          verified = false;
          seenMessageIds.clear();
          return publicState();
        }
        case 'verify':
          if (!session) throw new Error('尚未建立连接');
          verified = true;
          return publicState();
        case 'encrypt':
          if (!session || !verified) throw new Error('连接尚未完成安全核对');
          return encryptSessionMessage(session, payload.plaintext ?? '');
        case 'decrypt': {
          if (!session || !verified) throw new Error('连接尚未完成安全核对');
          const inspected = inspectMessage(payload.envelope ?? '');
          if (seenMessageIds.has(inspected.mid)) throw new Error('这条密文已经打开过一次');
          const decrypted = await decryptSessionMessage(session, payload.envelope ?? '');
          seenMessageIds.add(decrypted.messageId);
          return decrypted.plaintext;
        }
        case 'disconnect':
          session = null;
          verified = false;
          seenMessageIds.clear();
          return publicState();
        default:
          throw new Error('未知操作');
      }
    },
  };
}
