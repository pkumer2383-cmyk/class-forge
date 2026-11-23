import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_USER_DATA,
  LOCAL_DATA_KEY,
  loadLocalUserData,
  saveLocalUserData,
} from '../../src/lib/userData.js';
import { POST as postChat } from '../../src/app/api/chat/route.js';
import { POST as postAgents } from '../../src/app/api/agents/route.js';
import { GET as getPosStatus } from '../../src/app/api/pos/status/route.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('user data round-trips through browser storage', () => {
  const storage = memoryStorage();
  const data = {
    ...DEFAULT_USER_DATA,
    catalog: [{ id: 'c1', code: 'CS 101', sections: [] }],
    saved_schedules: [{ id: 'saved_1', name: 'Plan #1', sections: [] }],
  };

  assert.equal(saveLocalUserData(data, storage), true);
  const loaded = loadLocalUserData(storage);
  assert.deepEqual(loaded.catalog, data.catalog);
  assert.deepEqual(loaded.saved_schedules, data.saved_schedules);
  assert.equal(loaded.preferences.theme, 'dark');
});

test('nothing stored, unreadable data, or blocked storage load as null without throwing', () => {
  assert.equal(loadLocalUserData(memoryStorage()), null);
  const broken = memoryStorage();
  broken.setItem(LOCAL_DATA_KEY, '{not json');
  assert.equal(loadLocalUserData(broken), null);
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.equal(loadLocalUserData(blocked), null);
  assert.equal(saveLocalUserData(DEFAULT_USER_DATA, blocked), false);
  assert.equal(saveLocalUserData(DEFAULT_USER_DATA, null), false);
});

test('a guest draft saved before the open version still loads', () => {
  const storage = memoryStorage();
  storage.setItem(
    'class-forge.guest-draft.v1',
    JSON.stringify({ savedAt: '2026-11-01T00:00:00.000Z', data: { catalog: [{ id: 'old' }], preferences: { theme: 'light' } } }),
  );
  const loaded = loadLocalUserData(storage);
  assert.deepEqual(loaded.catalog, [{ id: 'old' }]);
  assert.equal(loaded.preferences.theme, 'light');
  assert.equal(loaded.preferences.forecastOverloadCredits, 18);
});

test('account-only API routes report not available in the open version', async () => {
  for (const response of [await postChat(), await postAgents(), await getPosStatus()]) {
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.match(body.error, /not available in the open version/);
  }
});
