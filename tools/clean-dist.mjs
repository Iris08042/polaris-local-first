import {
  existsSync,
  lstatSync,
  readdirSync,
  rmdirSync,
  unlinkSync
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(projectRoot, 'dist');

if (dirname(distDir) !== projectRoot || distDir !== resolve(projectRoot, 'dist')) {
  throw new Error(`Refusing to clean unexpected build directory: ${distDir}`);
}

function removeTree(target) {
  const relativeTarget = relative(distDir, target);
  if (relativeTarget.startsWith('..') || resolve(distDir, relativeTarget) !== target) {
    throw new Error(`Refusing to clean path outside build directory: ${target}`);
  }

  const stat = lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    unlinkSync(target);
    return;
  }

  for (const entry of readdirSync(target)) {
    removeTree(resolve(target, entry));
  }
  rmdirSync(target);
}

if (existsSync(distDir)) {
  if (lstatSync(distDir).isSymbolicLink()) {
    throw new Error(`Refusing to clean symlinked build directory: ${distDir}`);
  }
  removeTree(distDir);
  if (existsSync(distDir)) {
    throw new Error(`Build directory still exists after cleanup: ${distDir}`);
  }
}
