import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const appName = 'endless';
const bundleId = 'app.polaris.mac';
const desktopDistDir = path.join(root, 'desktop-dist');
const targetApp = path.join(desktopDistDir, `${appName}.app`);
const sourceApp = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app');
const sourceDist = path.join(root, 'dist');
const sourceDesktop = path.join(root, 'desktop');
const desktopApiOriginMarker = path.join(sourceDist, 'desktop-api-origin.json');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

if (process.platform !== 'darwin') {
  throw new Error('Polaris Mac desktop packaging currently runs on macOS only.');
}

if (!fs.existsSync(sourceApp)) {
  throw new Error(`Electron.app not found at ${sourceApp}`);
}

if (!fs.existsSync(path.join(sourceDist, 'index.html'))) {
  throw new Error('dist/index.html is missing. Run npm run build before packaging.');
}

if (!fs.existsSync(desktopApiOriginMarker)) {
  throw new Error('dist/desktop-api-origin.json is missing. Run npm run desktop:package so the desktop API origin is built explicitly.');
}

fs.rmSync(targetApp, { recursive: true, force: true });
fs.mkdirSync(desktopDistDir, { recursive: true });
execFileSync('ditto', [sourceApp, targetApp]);

const contentsDir = path.join(targetApp, 'Contents');
const resourcesDir = path.join(contentsDir, 'Resources');
const macOsDir = path.join(contentsDir, 'MacOS');
const appResourcesDir = path.join(resourcesDir, 'app');
const plistPath = path.join(contentsDir, 'Info.plist');
const electronExecutable = path.join(macOsDir, 'Electron');
const polarisExecutable = path.join(macOsDir, appName);

if (fs.existsSync(electronExecutable)) {
  fs.renameSync(electronExecutable, polarisExecutable);
}

fs.rmSync(appResourcesDir, { recursive: true, force: true });
fs.mkdirSync(appResourcesDir, { recursive: true });
copyDir(sourceDist, path.join(appResourcesDir, 'dist'));
copyDir(sourceDesktop, path.join(appResourcesDir, 'desktop'));
writePackagedPackageJson(path.join(appResourcesDir, 'package.json'));

writePlistValue(plistPath, 'CFBundleName', appName);
writePlistValue(plistPath, 'CFBundleDisplayName', appName);
writePlistValue(plistPath, 'CFBundleExecutable', appName);
writePlistValue(plistPath, 'CFBundleIdentifier', bundleId);
writePlistValue(plistPath, 'CFBundleIconFile', 'polaris');
writePlistValue(plistPath, 'CFBundleShortVersionString', packageJson.version);
writePlistValue(plistPath, 'CFBundleVersion', packageJson.version);
writePlistValue(plistPath, 'LSApplicationCategoryType', 'public.app-category.developer-tools');

createIcns(path.join(resourcesDir, 'polaris.icns'));
assertCleanPackagedApp(appResourcesDir);
writeManifest();

console.log(`endless Mac app bundle created at ${targetApp}`);
console.log(`Release manifest written to ${path.join(desktopDistDir, 'manifest.json')}`);
console.log('This bundle is unsigned and not notarized. Keep it as pre-release proof until signing passes.');

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  execFileSync('ditto', [from, to]);
}

function writePackagedPackageJson(targetPath) {
  const packaged = {
    name: 'polaris-desktop',
    productName: appName,
    version: packageJson.version,
    private: true,
    main: 'desktop/electron/main.cjs'
  };
  fs.writeFileSync(targetPath, `${JSON.stringify(packaged, null, 2)}\n`);
}

function writePlistValue(targetPlistPath, key, value) {
  const plistBuddy = '/usr/libexec/PlistBuddy';
  const setResult = spawnSync(plistBuddy, ['-c', `Set :${key} ${value}`, targetPlistPath]);

  if (setResult.status === 0) {
    return;
  }

  execFileSync(plistBuddy, ['-c', `Add :${key} string ${value}`, targetPlistPath]);
}

function createIcns(icnsPath) {
  const macSourcePng = path.join(root, 'public', 'icons', 'polaris-icon-mac-1024.png');
  const sourcePng = fs.existsSync(macSourcePng)
    ? macSourcePng
    : path.join(root, 'public', 'icons', 'polaris-icon-1024.png');
  const iconsetDir = path.join(desktopDistDir, 'Polaris.iconset');
  const variants = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ];

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Polaris source icon not found at ${sourcePng}`);
  }

  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const [filename, size] of variants) {
    execFileSync('sips', ['-z', String(size), String(size), sourcePng, '--out', path.join(iconsetDir, filename)], {
      stdio: 'ignore'
    });
  }

  fs.rmSync(icnsPath, { force: true });
  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath], { stdio: 'ignore' });
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

function assertCleanPackagedApp(appDir) {
  const blockedNames = new Set([
    '.env',
    '.env.local'
  ]);
  const allowedRootMarkdownFiles = new Set([
    'CHANGELOG.md',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'GOVERNANCE.md',
    'README.md',
    'SECURITY.md'
  ]);
  const blockedSuffixes = ['.map'];
  const blocked = [];

  for (const filePath of walk(appDir)) {
    const basename = path.basename(filePath);
    const relativePath = path.relative(appDir, filePath);
    const isRootMarkdown = !relativePath.includes(path.sep)
      && /^[A-Z0-9_ -]+\.md$/.test(basename)
      && !allowedRootMarkdownFiles.has(basename);
    if (
      blockedNames.has(basename)
      || blockedSuffixes.some((suffix) => basename.endsWith(suffix))
      || isRootMarkdown
    ) {
      blocked.push(path.relative(appDir, filePath));
    }
  }

  if (blocked.length > 0) {
    throw new Error(`Packaged app contains blocked local/debug artifacts:\n${blocked.join('\n')}`);
  }
}

function writeManifest() {
  const manifest = {
    channel: 'mac-desktop-website',
    appName,
    bundleId,
    version: packageJson.version,
    generatedAt: new Date().toISOString(),
    sourceHead: readGitValue(['rev-parse', '--short=12', 'HEAD']),
    appPath: path.relative(root, targetApp),
    desktopApiOrigin: readDesktopApiOrigin(),
    signed: false,
    notarized: false,
    entryUrl: 'polaris://app/index.html?surface=desktop',
    files: {
      infoPlist: fileSummary(path.join(targetApp, 'Contents', 'Info.plist')),
      mainProcess: fileSummary(path.join(targetApp, 'Contents', 'Resources', 'app', 'desktop', 'electron', 'main.cjs')),
      indexHtml: fileSummary(path.join(targetApp, 'Contents', 'Resources', 'app', 'dist', 'index.html')),
      desktopApiOrigin: fileSummary(path.join(targetApp, 'Contents', 'Resources', 'app', 'dist', 'desktop-api-origin.json')),
      packageJson: fileSummary(path.join(targetApp, 'Contents', 'Resources', 'app', 'package.json'))
    },
    distAssets: listDistAssets()
  };

  fs.writeFileSync(path.join(desktopDistDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function readDesktopApiOrigin() {
  const marker = JSON.parse(fs.readFileSync(desktopApiOriginMarker, 'utf-8'));
  return typeof marker.apiOrigin === 'string' ? marker.apiOrigin : null;
}

function readGitValue(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf-8'
  });

  return result.status === 0 ? result.stdout.trim() : null;
}

function fileSummary(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    path: path.relative(root, filePath),
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

function listDistAssets() {
  const assetsDir = path.join(sourceDist, 'assets');
  if (!fs.existsSync(assetsDir)) return [];

  return fs.readdirSync(assetsDir)
    .filter((filename) => !filename.endsWith('.map'))
    .sort();
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}
