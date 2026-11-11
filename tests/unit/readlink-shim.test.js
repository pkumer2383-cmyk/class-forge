import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../scripts/node-readlink-eisdir-shim.cjs', import.meta.url), 'utf8');

function setup({ platform = 'win32', code = 'EISDIR', kind = 'directory', statError = false } = {}) {
  const error = code ? Object.assign(new Error(`${code}: readlink`), { code, syscall: 'readlink' }) : null;
  const result = Buffer.from('target');
  const calls = [];
  let statCalls = 0;
  const fs = {
    lstatSync() {
      statCalls++;
      if (statError) throw new Error('lstat failed');
      return {
        isFile: () => kind === 'file',
        isDirectory: () => kind === 'directory',
        isSymbolicLink: () => kind === 'link',
      };
    },
    readlinkSync(path, options) {
      calls.push([path, options]);
      if (error) throw error;
      return result;
    },
    readlink(path, options, callback) {
      if (typeof callback !== 'function') throw new TypeError('callback required');
      calls.push([path, options]);
      queueMicrotask(() => callback(error, error ? undefined : result));
    },
    promises: {
      async readlink(path, options) {
        calls.push([path, options]);
        if (error) throw error;
        return result;
      },
    },
  };
  const originals = [fs.readlinkSync, fs.readlink, fs.promises.readlink];
  const context = vm.createContext({ require: () => fs, process: { platform }, Symbol });
  const load = () => vm.runInContext(`(() => {\n${source}\n})();`, context);
  load();
  return { fs, error, result, calls, originals, load, statCalls: () => statCalls };
}

async function invoke(fs, api, path = 'directory', options = { encoding: 'buffer' }) {
  if (api === 'sync') return fs.readlinkSync(path, options);
  if (api === 'promise') return fs.promises.readlink(path, options);
  return new Promise((resolve, reject) => fs.readlink(path, options, (error, value) => {
    if (error) reject(error);
    else resolve(value);
  }));
}

for (const api of ['sync', 'callback', 'promise']) {
  test(`${api}: normalizes Windows ordinary-directory errors`, async () => {
    const fixture = setup();
    await assert.rejects(invoke(fixture.fs, api), (error) => {
      assert.equal(error, fixture.error);
      assert.equal(error.code, 'EINVAL');
      assert.equal(error.message, 'EINVAL: readlink');
      assert.equal(error.syscall, 'readlink');
      return true;
    });
    assert.equal(fixture.statCalls(), 1);
  });

  for (const [label, options] of [
    ['symbolic link', { kind: 'link' }],
    ['unrecognized file type', { kind: 'other' }],
    ['lstat race or denial', { statError: true }],
    ['unrelated error', { code: 'EACCES' }],
  ]) {
    test(`${api}: preserves original error for ${label}`, async () => {
      const fixture = setup(options);
      const originalCode = fixture.error.code;
      await assert.rejects(invoke(fixture.fs, api), error => error === fixture.error && error.code === originalCode);
      assert.equal(fixture.statCalls(), options.code ? 0 : 1);
    });
  }

  test(`${api}: normalizes EISDIR for regular files on Windows volumes`, async () => {
    const fixture = setup({ kind: 'file' });
    await assert.rejects(invoke(fixture.fs, api), error => error === fixture.error && error.code === 'EINVAL');
    assert.equal(fixture.statCalls(), 1);
  });

  test(`${api}: preserves path/options and successful Buffer results`, async () => {
    const fixture = setup({ code: null });
    const path = new URL('file:///C:/example');
    const options = { encoding: 'buffer' };
    assert.equal(await invoke(fixture.fs, api, path, options), fixture.result);
    assert.deepEqual(fixture.calls, [[path, options]]);
    assert.equal(fixture.statCalls(), 0);
  });
}

test('callback overload works without options', async () => {
  const fixture = setup({ code: null });
  const result = await new Promise((resolve, reject) => fixture.fs.readlink('link', (error, value) => {
    if (error) reject(error);
    else resolve(value);
  }));
  assert.equal(result, fixture.result);
  assert.deepEqual(fixture.calls, [['link', undefined]]);
});

test('missing callback retains synchronous argument validation', () => {
  const { fs } = setup();
  assert.throws(() => fs.readlink('path'), TypeError);
});

test('loading from preload and config patches exactly once', () => {
  const fixture = setup();
  const patched = [fixture.fs.readlinkSync, fixture.fs.readlink, fixture.fs.promises.readlink];
  fixture.load();
  assert.deepEqual([fixture.fs.readlinkSync, fixture.fs.readlink, fixture.fs.promises.readlink], patched);
  assert.notEqual(patched[0], fixture.originals[0]);
});

test('non-Windows platforms retain native functions', () => {
  const fixture = setup({ platform: 'linux' });
  assert.deepEqual([fixture.fs.readlinkSync, fixture.fs.readlink, fixture.fs.promises.readlink], fixture.originals);
});
