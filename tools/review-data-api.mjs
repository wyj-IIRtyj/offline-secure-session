import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  createIdentity,
  decryptSessionMessage,
  deriveSession,
  encryptSessionMessage,
} from '../crypto-core.mjs';

export class ReviewPeerDataService {
  constructor() {
    this.fixtures = new Map();
  }

  describe() {
    return {
      api: 'offline-asym-review-peer-data-v1',
      role: 'caller-supplied-data-only',
      request_types: {
        peer_connection_code: {
          purpose: 'Create real peer protocol data for the UI under review.',
          required_context: [],
          returns: ['fixture_id', 'peer_connection_code'],
        },
        peer_verification: {
          purpose: 'Derive the peer side and return the independently computed verification code.',
          required_context: ['fixture_id', 'reviewer_connection_code'],
          returns: ['verification_code', 'session_id'],
        },
        peer_encrypt_message: {
          purpose: 'Return a ciphertext produced by the already-verified caller-side peer session.',
          required_context: ['fixture_id', 'plaintext'],
          prerequisite: 'peer_verification must have succeeded for this fixture_id',
          returns: ['ciphertext'],
        },
        peer_decrypt_message: {
          purpose: 'Open reviewed-UI ciphertext in the already-verified caller-side peer session.',
          required_context: ['fixture_id', 'ciphertext'],
          prerequisite: 'peer_verification must have succeeded for this fixture_id',
          returns: ['plaintext'],
        },
      },
      boundary: 'This API returns data only. It exposes no browser/device/UI control surface.',
    };
  }

  async request(requestType, context = {}) {
    if (requestType === 'peer_connection_code') {
      const identity = await createIdentity();
      const fixtureId = randomUUID();
      this.fixtures.set(fixtureId, {
        identity,
        reviewerConnectionCode: null,
        session: null,
      });
      return {
        fixture_id: fixtureId,
        peer_connection_code: identity.connectionCode,
      };
    }

    const fixtureId = String(context.fixture_id || '');
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) throw new Error('unknown fixture_id; request peer_connection_code first');

    if (requestType === 'peer_verification') {
      const session = await this.#sessionFor(fixture, context.reviewer_connection_code);
      return {
        verification_code: session.verificationCode,
        session_id: session.sessionId,
      };
    }

    if (requestType === 'peer_encrypt_message') {
      const session = this.#verifiedSession(fixture);
      const plaintext = String(context.plaintext ?? '');
      if (!plaintext) throw new Error('plaintext is required');
      return { ciphertext: await encryptSessionMessage(session, plaintext) };
    }

    if (requestType === 'peer_decrypt_message') {
      const session = this.#verifiedSession(fixture);
      const ciphertext = String(context.ciphertext ?? '');
      if (!ciphertext) throw new Error('ciphertext is required');
      const opened = await decryptSessionMessage(session, ciphertext);
      return { plaintext: opened.plaintext };
    }

    throw new Error(`unsupported request_type: ${requestType}`);
  }

  #verifiedSession(fixture) {
    if (!fixture.session) {
      throw new Error('peer_verification must succeed before message integration requests');
    }
    return fixture.session;
  }

  async #sessionFor(fixture, reviewerConnectionCode) {
    const code = String(reviewerConnectionCode || '').trim();
    if (!code) throw new Error('reviewer_connection_code is required');
    if (fixture.session && fixture.reviewerConnectionCode === code) return fixture.session;
    fixture.session = await deriveSession(fixture.identity, code);
    fixture.reviewerConnectionCode = code;
    return fixture.session;
  }
}

function sendJson(response, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('request body too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function createReviewDataServer(service = new ReviewPeerDataService()) {
  return http.createServer(async (request, response) => {
    try {
      if (request.method !== 'POST') {
        sendJson(response, 405, { ok: false, error: 'POST required' });
        return;
      }
      const body = await readJson(request);
      if (request.url === '/describe') {
        sendJson(response, 200, { ok: true, data: service.describe() });
        return;
      }
      if (request.url === '/request') {
        const data = await service.request(String(body.request_type || ''), body.context || {});
        sendJson(response, 200, { ok: true, data });
        return;
      }
      sendJson(response, 404, { ok: false, error: 'unknown endpoint' });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error?.message || String(error) });
    }
  });
}

export async function startReviewDataServer({ host = '127.0.0.1', port = 4174 } = {}) {
  const server = createReviewDataServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.REVIEW_DATA_PORT || process.argv[2] || 4174);
  const server = await startReviewDataServer({ port });
  const address = server.address();
  console.log(JSON.stringify({
    ok: true,
    api: 'offline-asym-review-peer-data-v1',
    address: typeof address === 'object' && address ? address.address : '127.0.0.1',
    port: typeof address === 'object' && address ? address.port : port,
  }));
}
