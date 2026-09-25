import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { testDB, request } from './test-db.mjs';
import { sharingRoutes } from './sharing.mjs';
import { libraryRoutes } from './library.mjs';
import { HttpError, json } from './http.mjs';

function fixture() {
  const env = { ...testDB(), PUBLIC_LAUNCH: 'true', SHARING_ENABLED: 'true' };
  env.sql.exec(readFileSync(new URL('./library-sharing.sql', import.meta.url), 'utf8'));
  for (const id of ['owner', 'recipient', 'stranger']) {
    env.sql.prepare('INSERT INTO accounts(id,email,created) VALUES (?,?,0)').run(id, `${id}@example.test`);
    env.sql.prepare('INSERT INTO account_identities VALUES (?,?,?)').run('google', `${id}-subject`, id);
  }
  const fileId = crypto.randomUUID(), siblingId = crypto.randomUUID(), folderId = crypto.randomUUID();
  env.sql.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?)').run(folderId, 'owner', '', 'Private folder', 'folder', null, 1, '2026-09-24T10:00:00Z');
  for (const [id, name, content] of [[fileId, 'Shared.fountain', 'old version'], [siblingId, 'Private.fountain', 'private sibling']]) {
    env.sql.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?)').run(id, 'owner', folderId, name, 'file', content, 1, '2026-09-24T10:00:00Z');
  }
  env.sql.prepare('UPDATE items SET content=?,revision=2,updated=? WHERE id=?').run('current writing é', '2026-09-24T11:00:00Z', fileId);
  return { env, fileId, siblingId, folderId };
}
const account = (id, free = false) => id ? { id, private_tester: free ? 0 : 1 } : null;
async function call(env, user, path, body, options = {}) {
  try {
    const req = options.request || request(path, body, '', options.origin);
    const result = await sharingRoutes(req, env, account(user, options.free));
    if (result) return result;
    if (path.startsWith('/api/library')) return await libraryRoutes(req, env, account(user, options.free));
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    return json({ error: error.message }, error.status);
  }
}
async function share(env, fileId) {
  const result = await call(env, 'owner', `/api/library/${fileId}/shares`, { email: 'recipient@example.test', role: 'read-only' });
  assert.equal(result.status, 201);
  return (await result.json()).share;
}

test('private pilot requires both literal launch flags for create and recipient access', async () => {
  const { env, fileId } = fixture();
  const grant = await share(env, fileId);
  for (const [launch, enabled] of [[undefined, 'true'], ['true', undefined], ['false', 'true'], ['true', 'false'], [true, true]]) {
    env.PUBLIC_LAUNCH = launch; env.SHARING_ENABLED = enabled;
    const ownerList = await (await call(env, 'owner', `/api/library/${fileId}/shares`)).json();
    assert.equal(ownerList.canShare, false); assert.match(ownerList.reason, /private pilot/);
    assert.equal(ownerList.shares.length, 1);
    assert.equal((await call(env, 'owner', `/api/library/${fileId}/shares`, { email: 'stranger@example.test' })).status, 403);
    assert.deepEqual((await (await call(env, 'recipient', '/api/shared')).json()).shares, []);
    assert.equal((await call(env, 'recipient', `/api/shared/${grant.id}`)).status, 403);
  }
  assert.equal((await call(env, 'owner', `/api/library/${fileId}/shares/${grant.id}/revoke`, {})).status, 200);
});

test('recipient sees current file only, without folder, owner IDs, private siblings or history', async () => {
  const { env, fileId, siblingId, folderId } = fixture(); const grant = await share(env, fileId);
  const list = await (await call(env, 'recipient', '/api/shared')).json();
  assert.equal(list.shares.length, 1); assert.equal(list.shares[0].name, 'Shared.fountain');
  assert.equal(list.shares[0].bytes, new TextEncoder().encode('current writing é').length);
  const detail = await (await call(env, 'recipient', `/api/shared/${grant.id}`)).json();
  assert.equal(detail.content, 'current writing é'); assert.equal(detail.readOnly, true);
  assert.equal(detail.role, 'read-only'); assert.equal(detail.revision, 2);
  for (const value of [detail, list.shares[0]]) for (const key of ['owner', 'parent', 'fileId', 'recipient_id', 'recipient_email']) assert.equal(key in value, false);
  for (const path of [`/api/library/${fileId}`, `/api/library/${siblingId}`, `/api/library?parent=${folderId}`, `/api/library/${fileId}/versions`, `/api/library/${fileId}/versions/${fileId}:1`, `/api/shared/${grant.id}/versions`, `/api/shared/${grant.id}/versions/${fileId}:1`]) {
    assert.equal((await call(env, 'recipient', path)).status, 404, path);
  }
  assert.deepEqual((await (await call(env, 'recipient', '/api/library')).json()).items, []);
  assert.equal((await (await call(env, 'recipient', '/api/library/usage')).json()).usedBytes, 0);
  env.sql.prepare('UPDATE items SET content=?,revision=3 WHERE id=?').run('fresh current', fileId);
  assert.equal((await (await call(env, 'recipient', `/api/shared/${grant.id}`)).json()).content, 'fresh current');
});

test('recipient cannot write, restore, re-share, revoke, or discover owner grants', async () => {
  const { env, fileId } = fixture(); const grant = await share(env, fileId);
  for (const path of [`/api/library/${fileId}/shares`, `/api/library/${fileId}/shares/${grant.id}/revoke`, `/api/library/${fileId}/restore`, `/api/shared/${grant.id}`, `/api/shared/${grant.id}/restore`, '/api/shared']) {
    assert.equal((await call(env, 'recipient', path, { email: 'stranger@example.test', revision: 2, versionId: `${fileId}:1` })).status, 404, path);
  }
  assert.equal((await call(env, 'recipient', `/api/library/${fileId}/shares`)).status, 404);
  const update = await call(env, 'recipient', '/api/library', { id: fileId, parent: '', name: 'Changed', kind: 'file', content: 'attack', revision: 2 });
  assert.equal(update.status, 409);
  assert.equal(env.sql.prepare('SELECT content FROM items WHERE id=?').get(fileId).content, 'current writing é');
});

test('share ID guessing cannot grant another account access and unauthenticated calls fail', async () => {
  const { env, fileId } = fixture(); const grant = await share(env, fileId);
  for (const user of ['stranger', 'owner']) {
    assert.equal((await call(env, user, `/api/shared/${grant.id}`)).status, 404);
    assert.deepEqual((await (await call(env, user, '/api/shared')).json()).shares, []);
  }
  for (const path of ['/api/shared', `/api/shared/${grant.id}`, `/api/library/${fileId}/shares`]) assert.equal((await call(env, null, path)).status, 401);
  assert.equal((await call(env, 'recipient', `/api/shared/${crypto.randomUUID()}`)).status, 404);
});

test('revocation is immediate and idempotent; re-sharing allocates a different immutable ID', async () => {
  const { env, fileId } = fixture(); const grant = await share(env, fileId);
  const path = `/api/library/${fileId}/shares/${grant.id}/revoke`;
  const first = (await (await call(env, 'owner', path, {})).json()).share;
  const second = (await (await call(env, 'owner', path, {})).json()).share;
  assert.ok(first.revokedAt); assert.equal(second.revokedAt, first.revokedAt);
  assert.equal((await call(env, 'recipient', `/api/shared/${grant.id}`)).status, 404);
  assert.deepEqual((await (await call(env, 'recipient', '/api/shared')).json()).shares, []);
  const next = await share(env, fileId); assert.notEqual(next.id, grant.id);
  assert.equal((await call(env, 'recipient', `/api/shared/${grant.id}`)).status, 404);
  assert.equal((await (await call(env, 'owner', `/api/library/${fileId}/shares`)).json()).shares.length, 2);
  assert.throws(() => env.sql.prepare('UPDATE file_shares SET revoked_at=NULL WHERE id=?').run(grant.id), /IMMUTABLE_SHARE/);
  assert.throws(() => env.sql.prepare('UPDATE file_shares SET recipient_id=? WHERE id=?').run('stranger', next.id), /IMMUTABLE_SHARE/);
});

test('concurrent duplicates create exactly one active grant and return the same ID', async () => {
  const { env, fileId } = fixture();
  const replies = await Promise.all([1, 2].map(() => call(env, 'owner', `/api/library/${fileId}/shares`, { email: ' RECIPIENT@example.test ' })));
  assert.deepEqual(replies.map(r => r.status).sort(), [200, 201]);
  const bodies = await Promise.all(replies.map(r => r.json())); assert.equal(bodies[0].share.id, bodies[1].share.id);
  assert.equal(env.sql.prepare('SELECT COUNT(*) AS n FROM file_shares').get().n, 1);
});

test('verified recipient resolution rejects absent, ambiguous, unverified and self accounts', async () => {
  const { env, fileId } = fixture();
  env.sql.prepare('INSERT INTO accounts(id,email,created) VALUES (?,?,0)').run('unverified', 'unverified@example.test');
  env.sql.prepare('INSERT INTO accounts(id,email,created) VALUES (?,?,0)').run('ambiguous', 'RECIPIENT@example.test');
  for (const email of ['missing@example.test', 'unverified@example.test', 'recipient@example.test', 'owner@example.test']) assert.equal((await call(env, 'owner', `/api/library/${fileId}/shares`, { email })).status, 400);
  assert.equal(env.sql.prepare('SELECT COUNT(*) AS n FROM file_shares').get().n, 0);
});

test('a share stays bound to account ID when an email changes or is reassigned', async () => {
  const { env, fileId } = fixture(); const grant = await share(env, fileId);
  env.sql.prepare('UPDATE accounts SET email=? WHERE id=?').run('changed@example.test', 'recipient');
  env.sql.prepare('UPDATE accounts SET email=? WHERE id=?').run('recipient@example.test', 'stranger');
  assert.equal((await call(env, 'recipient', `/api/shared/${grant.id}`)).status, 200);
  assert.equal((await call(env, 'stranger', `/api/shared/${grant.id}`)).status, 404);
});

test('downgrade preserves recipient reads and owner revocation, but forbids new grants', async () => {
  const { env, fileId } = fixture(); const grant = await share(env, fileId);
  const list = await (await call(env, 'owner', `/api/library/${fileId}/shares`, undefined, { free: true })).json();
  assert.equal(list.canShare, false); assert.match(list.reason, /Premium/);
  assert.equal((await call(env, 'owner', `/api/library/${fileId}/shares`, { email: 'stranger@example.test' }, { free: true })).status, 403);
  assert.equal((await call(env, 'recipient', `/api/shared/${grant.id}`, undefined, { free: true })).status, 200);
  assert.equal((await call(env, 'owner', `/api/library/${fileId}/shares/${grant.id}/revoke`, {}, { free: true })).status, 200);
});

test('origin checks protect creation and revocation; invalid roles and bodies fail', async () => {
  const { env, fileId } = fixture(); const grant = await share(env, fileId);
  for (const path of [`/api/library/${fileId}/shares`, `/api/library/${fileId}/shares/${grant.id}/revoke`]) assert.equal((await call(env, 'owner', path, { email: 'stranger@example.test' }, { origin: 'https://attacker.example' })).status, 403);
  for (const body of [null, [], {}, { email: 'bad' }, { email: 'stranger@example.test', role: 'editor' }, { email: 123 }]) assert.equal((await call(env, 'owner', `/api/library/${fileId}/shares`, body)).status, 400);
  assert.equal((await call(env, 'recipient', `/api/shared/${grant.id}`)).status, 200);
});

test('folder grants and foreign file ownership are never accepted or leaked', async () => {
  const { env, fileId, folderId, siblingId } = fixture(); const grant = await share(env, fileId);
  for (const user of ['owner', 'stranger']) assert.equal((await call(env, user, `/api/library/${folderId}/shares`, { email: 'recipient@example.test' })).status, 404);
  assert.equal((await call(env, 'stranger', `/api/library/${fileId}/shares`, { email: 'recipient@example.test' })).status, 404);
  assert.equal((await call(env, 'owner', `/api/library/${siblingId}/shares/${grant.id}/revoke`, {})).status, 404);
  // Existing history protections also prevent changing ownership under an active grant.
  assert.throws(() => env.sql.prepare('UPDATE items SET owner=? WHERE id=?').run('stranger', fileId), /INVALID_FILE_REVISION/);
});

test('unrelated routes return null; unsupported share operations fail closed', async () => {
  const { env, fileId } = fixture();
  assert.equal(await sharingRoutes(request('/api/account'), env, null), null);
  for (const path of [`/api/library/${fileId}/shares/unknown`, '/api/shared/not-a-uuid', '/api/shared//']) assert.equal((await call(env, 'owner', path)).status, 404);
  const deleteRequest = new Request(`https://writeshape.com/api/library/${fileId}/shares`, { method: 'DELETE' });
  assert.equal((await call(env, 'owner', '', undefined, { request: deleteRequest })).status, 404);
});
