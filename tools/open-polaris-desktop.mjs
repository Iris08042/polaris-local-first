import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const mainPath = path.join(root, 'desktop', 'electron', 'main.cjs');
const forwardedArgs = process.argv.slice(2);

if (process.platform === 'darwin') {
  openMacApp();
} else {
  openElectronFallback();
}

function openMacApp() {
  const sourceApp = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app');
  const targetApp = path.join(root, 'tmp', 'endless.app');
  const plistPath = path.join(targetApp, 'Contents', 'Info.plist');
  const resourcesDir = path.join(targetApp, 'Contents', 'Resources');
  const icnsPath = path.join(resourcesDir, 'polaris.icns');
  const electronExecutablePath = path.join(targetApp, 'Contents', 'MacOS', 'Electron');
  const polarisExecutablePath = path.join(targetApp, 'Contents', 'MacOS', 'endless');

  if (!fs.existsSync(sourceApp)) {
    throw new Error(`Electron app not found at ${sourceApp}`);
  }

  fs.rmSync(targetApp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetApp), { recursive: true });
  execFileSync('ditto', [sourceApp, targetApp]);

  if (fs.existsSync(electronExecutablePath)) {
    fs.renameSync(electronExecutablePath, polarisExecutablePath);
  }

  writePlistValue(plistPath, 'CFBundleName', 'endless');
  writePlistValue(plistPath, 'CFBundleDisplayName', 'endless');
  writePlistValue(plistPath, 'CFBundleExecutable', 'endless');
  writePlistValue(plistPath, 'CFBundleIdentifier', 'app.polaris.desktop.dev');
  writePlistValue(plistPath, 'CFBundleIconFile', 'polaris');

  try {
    createIcns(icnsPath);
  } catch (error) {
    console.warn(`Polaris iconset generation skipped: ${error.message}`);
  }

  const result = spawnSync('open', [targetApp, '--args', mainPath, ...forwardedArgs], {
    cwd: root,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writePlistValue(plistPath, key, value) {
  const plistBuddy = '/usr/libexec/PlistBuddy';
  const setResult = spawnSync(plistBuddy, ['-c', `Set :${key} ${value}`, plistPath]);

  if (setResult.status === 0) {
    return;
  }

  execFileSync(plistBuddy, ['-c', `Add :${key} string ${value}`, plistPath]);
}

function createIcns(icnsPath) {
  const macSourcePng = path.join(root, 'public', 'icons', 'polaris-icon-mac-1024.png');
  const sourcePng = fs.existsSync(macSourcePng)
    ? macSourcePng
    : path.join(root, 'public', 'icons', 'polaris-icon-1024.png');
  const iconsetDir = path.join(root, 'tmp', 'Polaris.iconset');
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
}

function openElectronFallback() {
  const electronBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
  const result = spawnSync(electronBin, [mainPath, ...forwardedArgs], {
    cwd: root,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
