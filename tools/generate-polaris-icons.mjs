import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const outDir = path.join(root, 'public', 'icons');
const sourcePath = path.join(outDir, 'endless-icon-source.png');
const macIconPath = path.join(outDir, 'polaris-icon-mac-1024.png');
const iosAppIconPath = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const androidResDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const sizes = [180, 192, 512, 1024];
const androidIconDensities = [
  { density: 'mdpi', launcher: 48, foreground: 108 },
  { density: 'hdpi', launcher: 72, foreground: 162 },
  { density: 'xhdpi', launcher: 96, foreground: 216 },
  { density: 'xxhdpi', launcher: 144, foreground: 324 },
  { density: 'xxxhdpi', launcher: 192, foreground: 432 }
];
const androidSplashTargets = [
  { dir: 'drawable', width: 480, height: 320 },
  { dir: 'drawable-port-mdpi', width: 320, height: 480 },
  { dir: 'drawable-port-hdpi', width: 480, height: 800 },
  { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { dir: 'drawable-port-xxhdpi', width: 960, height: 1600 },
  { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
  { dir: 'drawable-land-mdpi', width: 480, height: 320 },
  { dir: 'drawable-land-hdpi', width: 800, height: 480 },
  { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { dir: 'drawable-land-xxhdpi', width: 1600, height: 960 },
  { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280 }
];
const edgeWhiteThreshold = 242;
const nativeIconBackground = [196, 207, 171];

fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing endless icon source at ${path.relative(root, sourcePath)}`);
}

const source = PNG.sync.read(fs.readFileSync(sourcePath));
const prepared = prepareSource(source);
const canonicalIcon = flattenAlpha(resize(prepared, 1024), nativeIconBackground);
const macIcon = applyRoundedCornerMask(canonicalIcon, Math.round(1024 * 0.34));

for (const size of sizes) {
  const resized = resize(canonicalIcon, size);
  fs.writeFileSync(path.join(outDir, `polaris-icon-${size}.png`), PNG.sync.write(resized));
}

fs.writeFileSync(macIconPath, PNG.sync.write(macIcon));
fs.copyFileSync(path.join(outDir, 'polaris-icon-180.png'), path.join(outDir, 'apple-touch-icon.png'));
fs.mkdirSync(path.dirname(iosAppIconPath), { recursive: true });
fs.writeFileSync(iosAppIconPath, PNG.sync.write(canonicalIcon));

if (fs.existsSync(androidResDir)) {
  writeAndroidIcons(canonicalIcon);
  writeAndroidSplashScreens(canonicalIcon);
}

console.log(`Generated endless icons from ${path.relative(root, sourcePath)}`);

function writeAndroidIcons(image) {
  for (const { density, launcher, foreground } of androidIconDensities) {
    const densityDir = path.join(androidResDir, `mipmap-${density}`);
    fs.mkdirSync(densityDir, { recursive: true });

    const launcherIcon = resize(image, launcher);
    fs.writeFileSync(path.join(densityDir, 'ic_launcher.png'), PNG.sync.write(launcherIcon));
    fs.writeFileSync(path.join(densityDir, 'ic_launcher_round.png'), PNG.sync.write(launcherIcon));
    fs.writeFileSync(
      path.join(densityDir, 'ic_launcher_foreground.png'),
      PNG.sync.write(resize(image, foreground))
    );
  }

  const valuesDir = path.join(androidResDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#${nativeIconBackground.map(toHex).join('')}</color>\n</resources>\n`
  );
}

function writeAndroidSplashScreens(image) {
  for (const { dir, width, height } of androidSplashTargets) {
    const splashDir = path.join(androidResDir, dir);
    fs.mkdirSync(splashDir, { recursive: true });
    fs.writeFileSync(path.join(splashDir, 'splash.png'), PNG.sync.write(createSplash(image, width, height)));
  }
}

function prepareSource(image) {
  const transparentBackground = removeEdgeWhiteBackground(image);
  const bounds = findOpaqueBounds(transparentBackground);

  if (!bounds) {
    throw new Error('Polaris icon source has no visible pixels after background removal');
  }

  return crop(transparentBackground, bounds);
}

function removeEdgeWhiteBackground(image) {
  const output = clonePng(image);
  const visited = new Uint8Array(image.width * image.height);
  const queue = [];

  for (let x = 0; x < image.width; x += 1) {
    enqueueIfEdgeWhite(image, visited, queue, x, 0);
    enqueueIfEdgeWhite(image, visited, queue, x, image.height - 1);
  }

  for (let y = 0; y < image.height; y += 1) {
    enqueueIfEdgeWhite(image, visited, queue, 0, y);
    enqueueIfEdgeWhite(image, visited, queue, image.width - 1, y);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    const pixelIndex = (y * image.width + x) * 4;
    output.data[pixelIndex + 3] = 0;

    enqueueIfEdgeWhite(image, visited, queue, x + 1, y);
    enqueueIfEdgeWhite(image, visited, queue, x - 1, y);
    enqueueIfEdgeWhite(image, visited, queue, x, y + 1);
    enqueueIfEdgeWhite(image, visited, queue, x, y - 1);
  }

  return output;
}

function enqueueIfEdgeWhite(image, visited, queue, x, y) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return;
  }

  const visitedIndex = y * image.width + x;

  if (visited[visitedIndex]) {
    return;
  }

  visited[visitedIndex] = 1;

  if (isEdgeWhite(image, x, y)) {
    queue.push([x, y]);
  }
}

function isEdgeWhite(image, x, y) {
  const index = (y * image.width + x) * 4;
  const red = image.data[index];
  const green = image.data[index + 1];
  const blue = image.data[index + 2];
  const alpha = image.data[index + 3];

  return alpha > 0 && red >= edgeWhiteThreshold && green >= edgeWhiteThreshold && blue >= edgeWhiteThreshold;
}

function findOpaqueBounds(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];

      if (alpha === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function crop(image, bounds) {
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const side = Math.max(width, height);
  const output = new PNG({ width: side, height: side });
  const offsetX = Math.floor((side - width) / 2);
  const offsetY = Math.floor((side - height) / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = ((bounds.minY + y) * image.width + bounds.minX + x) * 4;
      const outputIndex = ((offsetY + y) * side + offsetX + x) * 4;

      output.data[outputIndex] = image.data[sourceIndex];
      output.data[outputIndex + 1] = image.data[sourceIndex + 1];
      output.data[outputIndex + 2] = image.data[sourceIndex + 2];
      output.data[outputIndex + 3] = image.data[sourceIndex + 3];
    }
  }

  return output;
}

function resize(image, size) {
  const output = new PNG({ width: size, height: size });
  const xScale = image.width / size;
  const yScale = image.height / size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = (x + 0.5) * xScale - 0.5;
      const sourceY = (y + 0.5) * yScale - 0.5;
      const color = sampleBilinear(image, sourceX, sourceY);
      const outputIndex = (y * size + x) * 4;

      output.data[outputIndex] = color[0];
      output.data[outputIndex + 1] = color[1];
      output.data[outputIndex + 2] = color[2];
      output.data[outputIndex + 3] = color[3];
    }
  }

  return output;
}

function flattenAlpha(image, background) {
  const output = new PNG({ width: image.width, height: image.height });

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      const alpha = image.data[index + 3] / 255;

      output.data[index] = Math.round(image.data[index] * alpha + background[0] * (1 - alpha));
      output.data[index + 1] = Math.round(image.data[index + 1] * alpha + background[1] * (1 - alpha));
      output.data[index + 2] = Math.round(image.data[index + 2] * alpha + background[2] * (1 - alpha));
      output.data[index + 3] = 255;
    }
  }

  return output;
}

function applyRoundedCornerMask(image, radius) {
  const output = clonePng(image);
  const width = image.width;
  const height = image.height;
  const maxX = width - 1;
  const maxY = height - 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const cornerX = x < radius
        ? radius
        : x > maxX - radius
          ? maxX - radius
          : null;
      const cornerY = y < radius
        ? radius
        : y > maxY - radius
          ? maxY - radius
          : null;
      if (cornerX === null || cornerY === null) continue;

      const distance = Math.hypot(x - cornerX, y - cornerY);
      const alphaScale = distance <= radius - 1
        ? 1
        : distance >= radius
          ? 0
          : radius - distance;

      output.data[index + 3] = Math.round(output.data[index + 3] * alphaScale);
    }
  }

  return output;
}

function centerOnCanvas(image, width, height, background) {
  const output = new PNG({ width, height });
  fillPng(output, background);

  const offsetX = Math.floor((width - image.width) / 2);
  const offsetY = Math.floor((height - image.height) / 2);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceIndex = (y * image.width + x) * 4;
      const outputIndex = ((offsetY + y) * width + offsetX + x) * 4;

      output.data[outputIndex] = image.data[sourceIndex];
      output.data[outputIndex + 1] = image.data[sourceIndex + 1];
      output.data[outputIndex + 2] = image.data[sourceIndex + 2];
      output.data[outputIndex + 3] = image.data[sourceIndex + 3];
    }
  }

  return output;
}

function createSplash(image, width, height) {
  const side = Math.round(Math.min(width, height) * 0.28);
  return centerOnCanvas(resize(image, side), width, height, [...nativeIconBackground, 255]);
}

function fillPng(image, color) {
  const [red, green, blue, alpha = 255] = color;

  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = red;
    image.data[index + 1] = green;
    image.data[index + 2] = blue;
    image.data[index + 3] = alpha;
  }
}

function sampleBilinear(image, x, y) {
  const x0 = clamp(Math.floor(x), 0, image.width - 1);
  const y0 = clamp(Math.floor(y), 0, image.height - 1);
  const x1 = clamp(x0 + 1, 0, image.width - 1);
  const y1 = clamp(y0 + 1, 0, image.height - 1);
  const tx = x - x0;
  const ty = y - y0;
  const top = mixPixel(readPixel(image, x0, y0), readPixel(image, x1, y0), tx);
  const bottom = mixPixel(readPixel(image, x0, y1), readPixel(image, x1, y1), tx);

  return mixPixel(top, bottom, ty).map((value) => Math.round(value));
}

function readPixel(image, x, y) {
  const index = (y * image.width + x) * 4;

  return [
    image.data[index],
    image.data[index + 1],
    image.data[index + 2],
    image.data[index + 3]
  ];
}

function mixPixel(a, b, t) {
  return a.map((value, index) => value + (b[index] - value) * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clonePng(image) {
  const output = new PNG({ width: image.width, height: image.height });
  image.data.copy(output.data);

  return output;
}

function toHex(value) {
  return value.toString(16).padStart(2, '0').toUpperCase();
}
