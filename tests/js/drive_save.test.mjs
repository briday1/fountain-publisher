import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { CollaborationClient } from '../../src/fountain_publisher/web/collaboration.mjs';
import * as Y from '../../src/fountain_publisher/web/vendor/yjs.mjs';

const app = await readFile(new URL('../../src/fountain_publisher/web/app.mjs', import.meta.url), 'utf8');
const worker = await readFile(new URL('../../github-worker/src/index.mjs', import.meta.url), 'utf8');
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const existing = { id: 'existing-file-id', name: 'Original.fountain', capabilities: { canEdit: true } };
const created = { id: 'created-file-id', name: 'Copy.fountain', capabilities: { canEdit: true } };

function harness(file = existing) {
  const state = { googleConnected: true, googleAccount: { id: 'account' }, documentRevision: 1, googleDriveFile: file, savedSource: 'baseline', collaborators: new Map(), handle: {}, githubFile: {} };
  const source = { value: 'submitted content' };
  const elements = new Map();
  const requests = [], connections = [], messages = [];
  let chooseCount = 0;
  const h = { state, source, requests, connections, messages, destination: { parentId: 'chosen-folder-id', name: 'Copy.fountain' }, response: { file: created }, dirty: true };
  const context = {
    state, source, console,
    $: id => { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); },
    document: { title: '', body: { classList: { toggle(_name, value) { h.dirty = value; } } } },
    updateGoogleMenu() {}, scheduleWorkspaceCache() {},
    toast: m => messages.push(m),
    chooseGoogleDriveDestination: async () => { chooseCount++; return await h.destination; },
    googleRequest: async (url, options) => { requests.push({ url, ...options, body: JSON.parse(options.body) }); return await h.response; },
    connectDriveCollaboration: (...args) => connections.push(args),
  };
  runInNewContext(section('async function saveGoogleDrive(', 'async function shareGoogleDrive('), context);
  return Object.assign(h, { context, save: options => context.saveGoogleDrive(options), chooseCount: () => chooseCount });
}

test('Save updates the same Drive ID without asking for a folder or changing its parents', async () => {
  const h = harness(); h.response = { file: { id: existing.id, name: existing.name } };
  await h.save();
  assert.equal(h.chooseCount(), 0);
  assert.equal(h.requests[0].method, 'PUT');
  assert.ok(h.requests[0].url.endsWith(existing.id));
  assert.deepEqual(Object.keys(h.requests[0].body), ['content']);
  assert.equal(h.state.savedSource, 'submitted content');
  assert.equal(h.state.googleDriveFile.capabilities.canEdit, true);
  assert.equal(h.connections.length, 0);
  assert.equal(h.dirty, false);
});

test('first Save and Save As create a new file in the explicitly selected destination', async () => {
  for (const file of [null, existing]) {
    const h = harness(file);
    await h.save({ saveAs: !!file });
    assert.equal(h.chooseCount(), 1);
    assert.equal(h.requests[0].method, 'POST');
    assert.equal(h.requests[0].body.parentId, 'chosen-folder-id');
    assert.equal(h.requests[0].body.name, 'Copy.fountain');
    assert.equal(h.state.googleDriveFile.id, created.id);
    assert.equal(h.state.filename, created.name);
    assert.equal(h.state.handle, null);
    assert.equal(h.state.githubFile, null);
    assert.equal(h.connections[0][0].id, created.id);
  }
});

test('cancelling the save destination makes no write and keeps the original association', async () => {
  const h = harness(); h.destination = null;
  await h.save({ saveAs: true });
  assert.equal(h.requests.length, 0);
  assert.equal(h.state.googleDriveFile, existing);
  assert.equal(h.state.savedSource, 'baseline');
});

test('duplicate save clicks are ignored while choosing or uploading', async () => {
  const wait = deferred(); const h = harness(null); h.destination = wait.promise;
  const pending = h.save(); await h.save();
  assert.equal(h.chooseCount(), 1);
  wait.resolve({ name: 'Copy.fountain', parentId: 'root' }); await pending;
  assert.equal(h.requests.length, 1);
  assert.equal(h.state.googleSaving, false);
});

test('switching documents or signing out while choosing a folder prevents a write', async () => {
  for (const change of [h => h.state.documentRevision++, h => h.state.googleConnected = false]) {
    const wait = deferred(); const h = harness(null); h.destination = wait.promise;
    const pending = h.save(); change(h);
    wait.resolve({ name: 'Copy.fountain', parentId: 'root' }); await pending;
    assert.equal(h.requests.length, 0);
  }
});

test('edits made during Save As stay dirty and are carried into the new collaboration session', async () => {
  const wait = deferred(); const h = harness(); h.response = wait.promise;
  const pending = h.save({ saveAs: true }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.requests.length, 1);
  h.source.value = 'newer edits'; wait.resolve({ file: created }); await pending;
  assert.equal(h.state.savedSource, 'submitted content');
  assert.equal(h.source.value, 'newer edits');
  assert.equal(h.dirty, true);
  assert.equal(h.connections[0][1], 'newer edits');
});

test('switching documents during upload never attaches the result to the new document', async () => {
  const wait = deferred(); const h = harness(); h.response = wait.promise;
  const pending = h.save(); h.state.documentRevision++;
  h.source.value = 'different screenplay'; wait.resolve({ file: created }); await pending;
  assert.equal(h.state.googleDriveFile, existing);
  assert.equal(h.state.savedSource, 'baseline');
  assert.equal(h.connections.length, 0);
});

test('failed Save As preserves the original file and dirty content', async () => {
  const h = harness(); h.context.googleRequest = async () => { throw new Error('Folder access denied'); };
  await h.save({ saveAs: true });
  assert.equal(h.state.googleDriveFile, existing);
  assert.equal(h.state.savedSource, 'baseline');
  assert.equal(h.state.googleSaving, false);
  assert.equal(h.messages[0], 'Folder access denied');
});

test('Share invokes the Google sharing dialog with the opened file and current token', async () => {
  const h = harness(); const calls = [];
  h.context.googleRequest = async () => ({ accessToken: 'test-token' });
  h.context.loadGoogleLibrary = async name => calls.push(name);
  h.context.window = { gapi: { drive: { share: { ShareClient: class {
    setOAuthToken(value) { calls.push(value); }
    setItemIds(value) { calls.push(Array.from(value)); }
    showSettingsDialog() { calls.push('show'); }
  } } } } };
  runInNewContext(section('async function shareGoogleDrive(', 'async function saveFile('), h.context);
  await h.context.shareGoogleDrive();
  assert.deepEqual(calls, ['drive-share', 'test-token', [existing.id], 'show']);
});

test('regular Save and Save As delegate to Drive for a linked document', async () => {
  const h = harness(); const calls = [];
  h.context.saveGoogleDrive = async options => calls.push(options.saveAs);
  runInNewContext(section('async function saveFile(', 'async function githubRequest('), h.context);
  await h.context.saveFile(); await h.context.saveFile(true);
  assert.deepEqual(calls, [false, true]);
});

function workerHarness(parent) {
  const calls = [];
  const context = {
    getGoogleSession: async () => ({ access_token: 'token' }),
    safeDriveId: id => typeof id === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(id),
    json: (body, status = 200) => ({ body, status }),
    randomToken: () => 'new-room',
    driveMultipart: (metadata, content) => ({ contentType: 'multipart/related', body: JSON.stringify({ metadata, content }) }),
    driveFetch: async (url, token, options) => { calls.push({ url, token, options }); return { json: async () => calls.length === 1 ? parent : created }; },
  };
  runInNewContext(worker.slice(worker.indexOf('async function googleApiRequest('), worker.indexOf('async function authorizeCollaboration(')), context);
  return { calls, create: body => context.googleApiRequest({ method: 'POST', json: async () => body }, {}, new URL('https://test/api/google/drive/files')) };
}

test('Worker creates content with the validated folder parent and shared-drive support', async () => {
  const h = workerHarness({ id: 'resolved-folder', mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } });
  const result = await h.create({ content: 'draft', name: 'draft.fountain', parentId: 'chosen-folder-id' });
  assert.equal(result.status, 201);
  assert.match(h.calls[0].url, /chosen-folder-id/);
  assert.match(h.calls[1].url, /supportsAllDrives=true/);
  assert.deepEqual(JSON.parse(h.calls[1].options.body).metadata.parents, ['chosen-folder-id']);
});

test('Worker rejects invalid, nonfolder, trashed, and unwritable save destinations before upload', async () => {
  const invalid = workerHarness({});
  assert.equal((await invalid.create({ content: 'draft', parentId: '../bad' })).status, 400);
  assert.equal(invalid.calls.length, 0);
  for (const parent of [
    { mimeType: 'text/plain' },
    { mimeType: 'application/vnd.google-apps.folder', trashed: true },
    { mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: false } },
  ]) {
    const h = workerHarness(parent);
    const result = await h.create({ content: 'draft', parentId: 'chosen-folder-id' });
    assert.ok([400, 403].includes(result.status));
    assert.equal(h.calls.length, 1);
  }
});

test('explicit My Drive and older clients both create in root without needing folder access', async () => {
  for (const parentId of ['root', undefined]) {
    const h = workerHarness(created);
    const result = await h.create({ name: 'draft.fountain', content: 'draft', parentId });
    assert.equal(result.status, 201);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(JSON.parse(h.calls[0].options.body).metadata.parents, ['root']);
  }
});

test('Google folder Picker resolves selection and cancellation and rejects nonfolders', async () => {
  for (const event of [
    { action: 'picked', docs: [{ id: 'folder-id', mimeType: 'application/vnd.google-apps.folder' }] },
    { action: 'cancel' },
    { action: 'picked', docs: [{ id: 'file-id', mimeType: 'text/plain' }] },
  ]) {
    let callback, shown = false, disposed = false;
    const settings = {};
    class DocsView {
      constructor(id) { settings.view = id; }
      setIncludeFolders(value) { settings.folders = value; return this; }
      setSelectFolderEnabled(value) { settings.selectFolders = value; return this; }
      setMimeTypes(value) { settings.mimeTypes = value; return this; }
    }
    class PickerBuilder {
      setAppId(value) { settings.appId = value; return this; }
      setDeveloperKey() { return this; }
      setOAuthToken() { return this; }
      setOrigin() { return this; }
      setTitle() { return this; }
      addView() { return this; }
      enableFeature() { return this; }
      setCallback(value) { callback = value; return this; }
      build() { return { setVisible: () => { shown = true; }, dispose: () => { disposed = true; } }; }
    }
    const context = {
      googleRequest: async () => ({ appId: '1234', apiKey: 'key', accessToken: 'token' }),
      loadGoogleLibrary: async name => assert.equal(name, 'picker'),
      window: { location: { origin: 'https://example.test' }, google: { picker: { DocsView, PickerBuilder, ViewId: { FOLDERS: 'folders' }, Feature: { SUPPORT_DRIVES: 'drives' }, Action: { PICKED: 'picked', CANCEL: 'cancel' } } } },
    };
    runInNewContext(section('async function chooseGoogleDriveFolder(', 'async function chooseGoogleDriveDestination('), context);
    const result = context.chooseGoogleDriveFolder();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(shown, true);
    assert.equal(settings.selectFolders, true);
    assert.equal(settings.mimeTypes, 'application/vnd.google-apps.folder');
    callback(event);
    if (event.docs?.[0].mimeType === 'text/plain') await assert.rejects(result, /choose a folder/);
    else assert.equal(await result, event.action === 'cancel' ? null : 'folder-id');
    assert.equal(disposed, true);
  }
});

test('new collaboration session preserves pending edits across initial server sync', () => {
  const values = [];
  const client = new CollaborationClient({ onDocument: v => values.push(v), onStatus() {}, onPresence() {} });
  client.openSocket = () => {};
  client.connect({ fileId: 'copy', documentId: 'room', canEdit: true, pendingContent: 'newer draft' });
  const serverDoc = new Y.Doc(); serverDoc.getText('source').insert(0, 'saved draft');
  const update = Buffer.from(Y.encodeStateAsUpdate(serverDoc)).toString('base64url');
  client.replace('newest draft');
  client.receive(JSON.stringify({ type: 'sync', update }));
  assert.equal(client.text.toString(), 'newest draft');
  assert.ok(!values.includes('saved draft'));
  client.disconnect(); serverDoc.destroy();
});

test('collaboration admission denies missing sessions, Drive denial, and mismatched room identity', async () => {
  const code = worker.slice(worker.indexOf('async function authorizeCollaboration('), worker.indexOf('function safeRepository('));
  const roomId = 'a'.repeat(48);
  for (const scenario of ['anonymous', 'drive-denied', 'wrong-room']) {
    let roomCalls = 0, driveCalls = 0;
    const context = {
      Headers, Request,
      json: (body, status) => ({ body, status }),
      safeDriveId: () => true,
      getGoogleSession: async () => scenario === 'anonymous' ? null : { access_token: 'user-token' },
      driveFetch: async (_url, token) => {
        driveCalls++; assert.equal(token, 'user-token');
        if (scenario === 'drive-denied') throw new Error('Drive denied access');
        return { json: async () => ({ appProperties: { fountainPublisherDocumentId: 'different-room' } }) };
      },
    };
    runInNewContext(code, context);
    const url = new URL(`https://api.example/api/collaboration/${roomId}?fileId=file-id`);
    const request = new Request(url, { headers: { upgrade: 'websocket', origin: 'https://app.example' } });
    const env = { APP_ORIGIN: 'https://app.example', COLLAB_ROOMS: { idFromName() { roomCalls++; } } };
    const result = context.authorizeCollaboration(request, env, url);
    if (scenario === 'drive-denied') await assert.rejects(result, /Drive denied/);
    else assert.equal((await result).status, scenario === 'anonymous' ? 401 : 403);
    assert.equal(roomCalls, 0);
    assert.equal(driveCalls, scenario === 'anonymous' ? 0 : 1);
  }
});
