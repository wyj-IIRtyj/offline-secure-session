import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIdentity,
  decryptSessionMessage,
  deriveSession,
  encryptSessionMessage,
} from '../crypto-core.mjs';
import {
  ReviewPeerDataService,
  startReviewDataServer,
} from '../tools/review-data-api.mjs';

test('caller data service supplies real peer data without exposing control surfaces', async () => {
  const service = new ReviewPeerDataService();
  const description = service.describe();
  assert.equal(description.role, 'caller-supplied-data-only');
  assert.match(description.boundary, /no browser\/device\/UI control surface/);

  const reviewerIdentity = await createIdentity();
  const peer = await service.request('peer_connection_code', {});
  assert.match(peer.peer_connection_code, /^OSC2\./);
  assert.ok(peer.fixture_id);

  const reviewerSession = await deriveSession(reviewerIdentity, peer.peer_connection_code);
  const peerVerification = await service.request('peer_verification', {
    fixture_id: peer.fixture_id,
    reviewer_connection_code: reviewerIdentity.connectionCode,
  });
  assert.equal(peerVerification.verification_code, reviewerSession.verificationCode);
  assert.equal(peerVerification.session_id, reviewerSession.sessionId);

  const incoming = await service.request('peer_encrypt_message', {
    fixture_id: peer.fixture_id,
    reviewer_connection_code: reviewerIdentity.connectionCode,
    plaintext: '来自 caller data API 的消息',
  });
  const reviewerOpened = await decryptSessionMessage(reviewerSession, incoming.ciphertext);
  assert.equal(reviewerOpened.plaintext, '来自 caller data API 的消息');

  const outgoing = await encryptSessionMessage(reviewerSession, 'reviewed UI outgoing payload');
  const peerOpened = await service.request('peer_decrypt_message', {
    fixture_id: peer.fixture_id,
    reviewer_connection_code: reviewerIdentity.connectionCode,
    ciphertext: outgoing,
  });
  assert.equal(peerOpened.plaintext, 'reviewed UI outgoing payload');
});

test('review data HTTP API exposes describe/request JSON only', async (t) => {
  const server = await startReviewDataServer({ port: 0 });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const base = `http://127.0.0.1:${address.port}`;

  const describeResponse = await fetch(`${base}/describe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: 'describe' }),
  });
  const describe = await describeResponse.json();
  assert.equal(describe.ok, true);
  assert.equal(describe.data.role, 'caller-supplied-data-only');

  const peerResponse = await fetch(`${base}/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      op: 'request',
      request_type: 'peer_connection_code',
      purpose: 'integration review',
      context: {},
    }),
  });
  const peer = await peerResponse.json();
  assert.equal(peer.ok, true);
  assert.match(peer.data.peer_connection_code, /^OSC2\./);
  assert.deepEqual(Object.keys(peer.data).sort(), ['fixture_id', 'peer_connection_code']);
});
