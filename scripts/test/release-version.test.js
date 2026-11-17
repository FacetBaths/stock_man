const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { nextVersion, prepareRelease } = require('../release-version');

test('successive releases advance even when source packages remain unchanged', () => {
  const packages = ['2.3.4', '2.3.4'];
  const tags = ['v2.1.0', 'v2.2.0'];
  for (const expected of ['2.3.4', '2.3.5', '2.3.6']) {
    assert.equal(nextVersion(packages, tags), expected);
    tags.push(`v${expected}`);
  }
});

test('manual minor and major versions are released as-is, then patch bumps resume', () => {
  assert.equal(nextVersion(['2.3.4', '2.4.0'], ['v2.3.9']), '2.4.0');
  assert.equal(nextVersion(['2.4.0', '2.4.0'], ['v2.4.0']), '2.4.1');
  assert.equal(nextVersion(['3.0.0', '2.3.4'], ['v2.4.1']), '3.0.0');
  assert.equal(nextVersion(['3.0.0', '3.0.0'], ['v3.0.0']), '3.0.1');
});

test('versions sort numerically and unrelated or prerelease tags are ignored', () => {
  assert.equal(nextVersion(['2.3.4', '2.3.4'], [
    'v2.3.9', 'v2.3.10', 'v2.3.2', 'v10.0.0-beta.1', 'other'
  ]), '2.3.11');
  assert.equal(nextVersion(['2.3.4', '2.3.4'], []), '2.3.4');
});

test('invalid manual versions fail instead of publishing incorrect release metadata', () => {
  for (const invalid of ['2.4', '02.4.0', '2.4.0-beta', '2.4.0\n', '9007199254740992.0.0']) {
    assert.throws(() => nextVersion(['2.3.4', invalid], ['v2.3.4']));
  }
});

test('release preparation reads real git tags and synchronizes both packages and lockfiles', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init');
  git('-c', 'user.name=Release Test', '-c', 'user.email=test@example.com',
    'commit', '--allow-empty', '-m', 'fixture');
  git('tag', 'v2.3.9');
  fs.mkdirSync(path.join(root, 'frontend'));
  for (const dir of ['', 'frontend']) {
    fs.writeFileSync(path.join(root, dir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '2.3.4', scripts: { test: 'kept' } }));
    fs.writeFileSync(path.join(root, dir, 'package-lock.json'),
      JSON.stringify({ version: '2.3.4', packages: {
        '': { version: '2.3.4' }, 'node_modules/fixture': { version: '1.0.0' }
      } }));
  }
  assert.equal(prepareRelease(root), '2.3.10');
  for (const dir of ['', 'frontend']) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json')));
    const lock = JSON.parse(fs.readFileSync(path.join(root, dir, 'package-lock.json')));
    assert.equal(pkg.version, '2.3.10');
    assert.equal(pkg.scripts.test, 'kept');
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[''].version, pkg.version);
    assert.equal(lock.packages['node_modules/fixture'].version, '1.0.0');
  }
  // Failed builds do not consume a version: only the workflow publishes tags.
  assert.equal(prepareRelease(root), '2.3.10');
  git('tag', 'v2.3.10');
  assert.equal(prepareRelease(root), '2.3.11');
});
