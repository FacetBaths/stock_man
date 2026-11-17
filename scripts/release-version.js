const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function parseVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Expected a stable major.minor.patch version, received: ${version}`);
  }
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error(`Version is too large: ${version}`);
  return parts;
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function nextVersion(packageVersions, tags) {
  const baseline = packageVersions.reduce((highest, version) =>
    compareVersions(version, highest) > 0 ? version : highest);
  const releases = tags
    .filter(tag => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    .map(tag => tag.slice(1))
    .sort(compareVersions);
  const latest = releases[releases.length - 1];

  // An explicit higher version (e.g. 2.4.0 or 3.0.0) wins without another bump.
  if (!latest || compareVersions(baseline, latest) > 0) return baseline;
  const [major, minor, patch] = parseVersion(latest);
  const version = `${major}.${minor}.${patch + 1}`;
  parseVersion(version);
  return version;
}

function prepareRelease(root) {
  const packagePaths = ['package.json', 'frontend/package.json'];
  const packages = packagePaths.map(file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')));
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { cwd: root, encoding: 'utf8' })
    .trim().split('\n');
  const version = nextVersion(packages.map(pkg => pkg.version), tags);
  const files = [];

  for (let i = 0; i < packagePaths.length; i++) {
    const file = packagePaths[i];
    const lockFile = file.replace('package.json', 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(path.join(root, lockFile), 'utf8'));
    if (!lock.packages?.['']) throw new Error(`Missing root package metadata in ${lockFile}`);
    packages[i].version = version;
    lock.version = version;
    lock.packages[''].version = version;
    files.push([file, packages[i]], [lockFile, lock]);
  }
  for (const [file, data] of files) {
    fs.writeFileSync(path.join(root, file), `${JSON.stringify(data, null, 2)}\n`);
  }
  return version;
}

if (require.main === module) {
  const version = prepareRelease(path.resolve(__dirname, '..'));
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `NEW_VERSION=${version}\n`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  console.log(`Release version: ${version}`);
}

module.exports = { nextVersion, prepareRelease };
