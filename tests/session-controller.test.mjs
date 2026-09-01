import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController } from '../session-controller.mjs';

test('controller never exposes private/session keys to page state', async () => {
  const controller = createSessionController();
  const state = await controller.handle('init');
  assert.ok(state.connectionCode);
  assert.equal('privateKey' in state, false);
  assert.equal('key' in state, false);
  assert.equal('sessionKey' in state, false);
});

test('messaging is blocked until both sides explicitly complete verification', async () => {
  const alice = createSessionController();
  const bob = createSessionController();
  const aliceInit = await alice.handle('init');
  const bobInit = await bob.handle('init');

  const aliceConnected = await alice.handle('connect', { peerConnectionCode: bobInit.connectionCode });
  const bobConnected = await bob.handle('connect', { peerConnectionCode: aliceInit.connectionCode });

  assert.equal(aliceConnected.verificationCode, bobConnected.verificationCode);
  assert.equal(aliceConnected.verified, false);
  assert.equal(bobConnected.verified, false);

  await assert.rejects(alice.handle('encrypt', { plaintext: 'blocked' }), /安全核对/);
  await assert.rejects(bob.handle('decrypt', { envelope: '{}' }), /安全核对/);

  await alice.handle('verify');
  await bob.handle('verify');

  const envelope = await alice.handle('encrypt', { plaintext: 'verified message' });
  assert.equal(await bob.handle('decrypt', { envelope }), 'verified message');
});

test('controller supports bidirectional messages and rejects replay', async () => {
  const alice = createSessionController();
  const bob = createSessionController();
  const aliceInit = await alice.handle('init');
  const bobInit = await bob.handle('init');
  await alice.handle('connect', { peerConnectionCode: bobInit.connectionCode });
  await bob.handle('connect', { peerConnectionCode: aliceInit.connectionCode });
  await alice.handle('verify');
  await bob.handle('verify');

  const aToB = await alice.handle('encrypt', { plaintext: 'A→B' });
  assert.equal(await bob.handle('decrypt', { envelope: aToB }), 'A→B');
  await assert.rejects(bob.handle('decrypt', { envelope: aToB }), /已经打开过一次/);

  const bToA = await bob.handle('encrypt', { plaintext: 'B→A' });
  assert.equal(await alice.handle('decrypt', { envelope: bToA }), 'B→A');
});
