import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIdentity,
  decryptSessionMessage,
  deriveSession,
  encryptSessionMessage,
  inspectMessage,
  parseConnectionCode,
} from '../crypto-core.mjs';

test('identity keeps private key non-extractable and exposes only public connection code', async () => {
  const identity = await createIdentity();
  assert.equal(identity.privateKey.extractable, false);
  assert.match(identity.connectionCode, /^OSC2\.[A-Za-z0-9_-]+$/);
  const parsed = parseConnectionCode(identity.connectionCode);
  assert.equal(parsed.bundle.kind, 'offline-secure-session');
  assert.equal(parsed.bundle.curve, 'P-256');
});

test('two parties independently derive the same session id and verification code', async () => {
  const [alice, bob] = await Promise.all([createIdentity(), createIdentity()]);
  const [aliceSession, bobSession] = await Promise.all([
    deriveSession(alice, bob.connectionCode),
    deriveSession(bob, alice.connectionCode),
  ]);

  assert.equal(aliceSession.sessionId, bobSession.sessionId);
  assert.equal(aliceSession.verificationCode, bobSession.verificationCode);
  assert.match(aliceSession.verificationCode, /^\d{4} \d{4} \d{4}$/);
  assert.equal(aliceSession.key.extractable, false);
  assert.equal(bobSession.key.extractable, false);
});

test('established session encrypts both directions with the same shared key', async () => {
  const [alice, bob] = await Promise.all([createIdentity(), createIdentity()]);
  const [aliceSession, bobSession] = await Promise.all([
    deriveSession(alice, bob.connectionCode),
    deriveSession(bob, alice.connectionCode),
  ]);

  const aToB = await encryptSessionMessage(aliceSession, 'Alice → Bob：机密 🔐');
  const bOpened = await decryptSessionMessage(bobSession, aToB);
  assert.equal(bOpened.plaintext, 'Alice → Bob：机密 🔐');

  const bToA = await encryptSessionMessage(bobSession, 'Bob → Alice：收到');
  const aOpened = await decryptSessionMessage(aliceSession, bToA);
  assert.equal(aOpened.plaintext, 'Bob → Alice：收到');
});

test('same plaintext produces randomized ciphertext under the established session', async () => {
  const [alice, bob] = await Promise.all([createIdentity(), createIdentity()]);
  const aliceSession = await deriveSession(alice, bob.connectionCode);
  const [a, b] = await Promise.all([
    encryptSessionMessage(aliceSession, 'same message'),
    encryptSessionMessage(aliceSession, 'same message'),
  ]);
  assert.notEqual(a, b);
  assert.notEqual(inspectMessage(a).mid, inspectMessage(b).mid);
  assert.notEqual(inspectMessage(a).iv, inspectMessage(b).iv);
});

test('tampered ciphertext is rejected', async () => {
  const [alice, bob] = await Promise.all([createIdentity(), createIdentity()]);
  const [aliceSession, bobSession] = await Promise.all([
    deriveSession(alice, bob.connectionCode),
    deriveSession(bob, alice.connectionCode),
  ]);
  const envelope = JSON.parse(await encryptSessionMessage(aliceSession, 'do not modify'));
  const i = Math.floor(envelope.data.length / 2);
  envelope.data = envelope.data.slice(0, i) + (envelope.data[i] === 'A' ? 'B' : 'A') + envelope.data.slice(i + 1);
  await assert.rejects(
    decryptSessionMessage(bobSession, JSON.stringify(envelope)),
    /损坏|修改|不匹配/,
  );
});

test('message from another session is rejected before decryption', async () => {
  const [alice, bob, mallory] = await Promise.all([createIdentity(), createIdentity(), createIdentity()]);
  const aliceBob = await deriveSession(alice, bob.connectionCode);
  const bobAlice = await deriveSession(bob, alice.connectionCode);
  const malloryBob = await deriveSession(mallory, bob.connectionCode);

  const wrongMessage = await encryptSessionMessage(malloryBob, 'wrong session');
  await assert.rejects(
    decryptSessionMessage(bobAlice, wrongMessage),
    /不属于当前连接/,
  );

  const goodMessage = await encryptSessionMessage(aliceBob, 'right session');
  assert.equal((await decryptSessionMessage(bobAlice, goodMessage)).plaintext, 'right session');
});

test('cannot establish a session with own connection code', async () => {
  const identity = await createIdentity();
  await assert.rejects(
    deriveSession(identity, identity.connectionCode),
    /自己的连接码/,
  );
});
