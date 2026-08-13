const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { app, BrowserWindow, Menu, Tray, nativeImage, protocol, shell, ipcMain, dialog } = require('electron');
const {
  normalizeDesktopRelativePath,
  resolveDesktopLocalPath,
  resolveDesktopLocalWritablePath
} = require('./desktopLocalPathBoundary.cjs');

const APP_NAME = 'endless';
const DESKTOP_SCHEME = 'polaris';
const MAINTENANCE_BACKUP_HOST = 'maintenance-backup';
const MAINTENANCE_BACKUP_PATH = '/import.zip';
const DEV_SERVER_URL = resolveDevServerUrl();
const KEEP_ALIVE_IN_BACKGROUND = resolveKeepAliveInBackground();
const REMOTE_DEBUGGING_PORT = resolveRemoteDebuggingPort();
const MAINTENANCE_IMPORT_BACKUP_PATH = resolveMaintenanceImportBackupPath();
const TRAY_TITLE = process.platform === 'darwin' ? '✦ endless' : '';

let mainWindow = null;
let statusTray = null;
let isQuitting = false;
let desktopLocalConfig = null;
const desktopCommandSessions = new Map();

const DESKTOP_SYNC_IGNORED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.polaris',
  '.next',
  '.turbo',
  '.vercel',
  '.cache',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'desktop-dist'
]);

const DESKTOP_SYNC_TEXT_EXTENSIONS = new Set([
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'json',
  'md',
  'txt',
  'yaml',
  'yml',
  'xml',
  'svg',
  'csv'
]);

app.setName(APP_NAME);

if (REMOTE_DEBUGGING_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', REMOTE_DEBUGGING_PORT);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

function resolveDevServerUrl() {
  const argValue = process.argv
    .find((arg) => arg.startsWith('--dev-server='))
    ?.slice('--dev-server='.length)
    .trim();

  return process.env.POLARIS_DESKTOP_DEV_SERVER?.trim() || argValue || '';
}

function resolveKeepAliveInBackground() {
  if (process.env.POLARIS_DESKTOP_BACKGROUND === '0') {
    return false;
  }

  return !process.argv.includes('--no-background');
}

function resolveRemoteDebuggingPort() {
  const argValue = process.argv
    .find((arg) => arg.startsWith('--remote-debugging-port='))
    ?.slice('--remote-debugging-port='.length)
    .trim();
  const envValue = process.env.POLARIS_DESKTOP_REMOTE_DEBUGGING_PORT?.trim();
  const port = envValue || argValue || '';

  return /^\d+$/.test(port) ? port : '';
}

function resolveMaintenanceImportBackupPath() {
  const argValue = process.argv
    .find((arg) => arg.startsWith('--local-data-import-backup-path='))
    ?.slice('--local-data-import-backup-path='.length)
    .trim();
  const envValue = process.env.POLARIS_LOCAL_DATA_IMPORT_BACKUP_PATH?.trim();
  const backupPath = envValue || argValue || '';

  if (!backupPath) {
    return '';
  }

  const resolvedPath = path.resolve(backupPath);
  return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile() ? resolvedPath : '';
}

function resolveDistPath(requestUrl) {
  const distRoot = path.join(resolveProjectRoot(), 'dist');
  const parsedUrl = new URL(requestUrl);
  if (parsedUrl.hostname === MAINTENANCE_BACKUP_HOST) {
    return MAINTENANCE_IMPORT_BACKUP_PATH && parsedUrl.pathname === MAINTENANCE_BACKUP_PATH
      ? MAINTENANCE_IMPORT_BACKUP_PATH
      : null;
  }
  const pathname = decodeURIComponent(parsedUrl.pathname || '/');
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(distRoot, `.${requestedPath}`);
  const insideDist = filePath === distRoot || filePath.startsWith(`${distRoot}${path.sep}`);

  if (!insideDist) {
    return null;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  return path.join(distRoot, 'index.html');
}

function resolveIconPath(preferredSize) {
  const projectRoot = resolveProjectRoot();
  const macIconCandidates = process.platform === 'darwin'
    ? [
        path.join(projectRoot, 'dist', 'icons', 'polaris-icon-mac-1024.png'),
        path.join(projectRoot, 'public', 'icons', 'polaris-icon-mac-1024.png')
      ]
    : [];
  const candidates = [
    ...macIconCandidates,
    path.join(projectRoot, 'dist', 'icons', `polaris-icon-${preferredSize}.png`),
    path.join(projectRoot, 'public', 'icons', `polaris-icon-${preferredSize}.png`),
    path.join(projectRoot, 'dist', 'icons', 'polaris-icon-512.png'),
    path.join(projectRoot, 'public', 'icons', 'polaris-icon-512.png'),
    path.join(projectRoot, 'dist', 'icons', 'polaris-icon-192.png'),
    path.join(projectRoot, 'public', 'icons', 'polaris-icon-192.png')
  ];

  return candidates.find((candidatePath) => fs.existsSync(candidatePath)) || '';
}

function createIconImage(preferredSize) {
  const iconPath = resolveIconPath(preferredSize);

  if (!iconPath) {
    return null;
  }

  const image = nativeImage.createFromPath(iconPath);

  return image.isEmpty() ? null : image;
}

function resolveProjectRoot() {
  const appPath = app.getAppPath();

  if (fs.existsSync(path.join(appPath, 'package.json'))) {
    return appPath;
  }

  return path.resolve(appPath, '..', '..');
}

function registerDesktopProtocol() {
  protocol.registerFileProtocol(DESKTOP_SCHEME, (request, callback) => {
    const filePath = resolveDistPath(request.url);

    if (!filePath) {
      callback({ error: -10 });
      return;
    }

    callback({ path: filePath });
  });
}

function isAppUrl(rawUrl) {
  if (DEV_SERVER_URL && rawUrl.startsWith(DEV_SERVER_URL)) {
    return true;
  }

  return rawUrl.startsWith(`${DESKTOP_SCHEME}://app`);
}

function withDesktopSurfaceParam(rawUrl) {
  const url = new URL(rawUrl);

  if (!url.searchParams.has('surface')) {
    url.searchParams.set('surface', 'desktop');
  }

  return url.toString();
}

function withMaintenanceParams(rawUrl) {
  const url = new URL(rawUrl);
  const shouldPromoteLive = process.argv.includes('--local-data-promote-live');

  if (shouldPromoteLive) {
    url.searchParams.set('local-data-promote-live', '1');
  }
  if (shouldPromoteLive && MAINTENANCE_IMPORT_BACKUP_PATH) {
    url.searchParams.set('local-data-import-backup', '1');
  }

  return url.toString();
}

function createWindow() {
  const windowIcon = createIconImage(512);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 500,
    minHeight: 460,
    title: APP_NAME,
    backgroundColor: '#eef0f6',
    show: false,
    icon: windowIcon || undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: !app.isPackaged || process.env.POLARIS_DESKTOP_DEVTOOLS === '1'
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting || !KEEP_ALIVE_IN_BACKGROUND) {
      return;
    }

    event.preventDefault();
    mainWindow.hide();
    updateStatusTrayMenu();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    updateStatusTrayMenu();
  });

  mainWindow.on('show', updateStatusTrayMenu);
  mainWindow.on('hide', updateStatusTrayMenu);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const entryUrl = withDesktopSurfaceParam(withMaintenanceParams(DEV_SERVER_URL || `${DESKTOP_SCHEME}://app/index.html`));
  mainWindow.loadURL(entryUrl);

  return mainWindow;
}

function createDefaultDesktopLocalConfig() {
  return {
    permissionMode: 'confirm-each',
    trustedRoots: []
  };
}

function normalizeDesktopLocalConfig(config) {
  const fallback = createDefaultDesktopLocalConfig();
  const permissionMode = config?.permissionMode === 'trusted' ? 'trusted' : 'confirm-each';
  const seenPaths = new Set();
  const trustedRoots = Array.isArray(config?.trustedRoots)
    ? config.trustedRoots.flatMap((root) => {
        const rootPath = typeof root?.path === 'string' ? path.resolve(root.path) : '';
        if (!rootPath || seenPaths.has(rootPath)) return [];
        seenPaths.add(rootPath);
        return [{
          id: typeof root?.id === 'string' && root.id.trim() ? root.id : createDesktopRootId(),
          label: typeof root?.label === 'string' && root.label.trim() ? root.label.trim() : path.basename(rootPath) || rootPath,
          path: rootPath,
          createdAt: typeof root?.createdAt === 'number' ? root.createdAt : Date.now(),
          lastUsedAt: typeof root?.lastUsedAt === 'number' ? root.lastUsedAt : null
        }];
      })
    : fallback.trustedRoots;

  return {
    permissionMode,
    trustedRoots
  };
}

function resolveDesktopLocalConfigPath() {
  return path.join(app.getPath('userData'), 'desktop-local-host.json');
}

function readDesktopLocalConfig() {
  if (desktopLocalConfig) return desktopLocalConfig;

  const configPath = resolveDesktopLocalConfigPath();
  try {
    desktopLocalConfig = normalizeDesktopLocalConfig(
      fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        : null
    );
  } catch {
    desktopLocalConfig = createDefaultDesktopLocalConfig();
  }

  return desktopLocalConfig;
}

function writeDesktopLocalConfig(config) {
  desktopLocalConfig = normalizeDesktopLocalConfig(config);
  const configPath = resolveDesktopLocalConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(desktopLocalConfig, null, 2)}\n`);
  return desktopLocalConfig;
}

function createDesktopRootId() {
  return `local-root-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDesktopLocalState() {
  const config = readDesktopLocalConfig();
  return {
    available: true,
    platform: process.platform,
    permissionMode: config.permissionMode,
    trustedRoots: config.trustedRoots.map((root) => ({ ...root }))
  };
}

function findTrustedRoot(rootId) {
  const config = readDesktopLocalConfig();
  const root = config.trustedRoots.find((entry) => entry.id === rootId);
  if (!root) {
    throw new Error('这个本地工作区已经不在授权列表里。');
  }
  return root;
}

function resolveInsideTrustedRoot(rootId, relativePath = '', options = {}) {
  const root = findTrustedRoot(rootId);
  const { targetPath } = resolveDesktopLocalPath(root.path, relativePath, options);

  return { root, targetPath };
}

function resolveWritableInsideTrustedRoot(rootId, relativePath = '') {
  const root = findTrustedRoot(rootId);
  const { targetPath } = resolveDesktopLocalWritablePath(root.path, relativePath);

  return { root, targetPath };
}

function desktopDirentKind(stat) {
  if (stat.isDirectory()) return 'directory';
  if (stat.isFile()) return 'file';
  return 'other';
}

function normalizeDesktopCommandStep(step) {
  const command = typeof step?.command === 'string' ? step.command.trim() : '';
  if (!command) return null;
  const args = Array.isArray(step?.args)
    ? step.args.map((arg) => String(arg))
    : [];
  const cwdRelativePath = normalizeDesktopRelativePath(step?.cwdRelativePath);
  const label = typeof step?.label === 'string' ? step.label.trim() : '';
  return {
    ...(label ? { label } : {}),
    command,
    args,
    cwdRelativePath
  };
}

function shouldTraverseDesktopSyncDirectory(relativePath) {
  const segments = normalizeDesktopRelativePath(relativePath).split('/').filter(Boolean);
  const name = segments[segments.length - 1] || '';
  return Boolean(name) && !DESKTOP_SYNC_IGNORED_DIRECTORIES.has(name);
}

function isDesktopSyncTextFile(relativePath) {
  const normalized = normalizeDesktopRelativePath(relativePath);
  if (!normalized || normalized.startsWith('.polaris/')) {
    return false;
  }
  const extension = normalized.split('.').pop()?.toLowerCase() || '';
  return DESKTOP_SYNC_TEXT_EXTENSIONS.has(extension);
}

async function collectDesktopWorkspaceTextFiles(rootId, relativeDirectory = '') {
  const { root, targetPath } = resolveInsideTrustedRoot(rootId, relativeDirectory);
  const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = normalizeDesktopRelativePath(
      relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
    );
    if (!relativePath) continue;

    if (entry.isDirectory()) {
      if (!shouldTraverseDesktopSyncDirectory(relativePath)) continue;
      files.push(...await collectDesktopWorkspaceTextFiles(root.id, relativePath));
      continue;
    }

    if (!entry.isFile() || !isDesktopSyncTextFile(relativePath)) {
      continue;
    }

    const { targetPath: filePath } = resolveInsideTrustedRoot(root.id, relativePath);
    const [content, stat] = await Promise.all([
      fs.promises.readFile(filePath, 'utf-8'),
      fs.promises.stat(filePath)
    ]);
    files.push({
      relativePath,
      content,
      bytes: Buffer.byteLength(content, 'utf-8'),
      updatedAt: stat.mtimeMs
    });
  }

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function confirmDesktopLocalOperation(kind, details) {
  const config = readDesktopLocalConfig();
  if (config.permissionMode === 'trusted' && kind !== 'run' && kind !== 'delete') {
    return;
  }

  const result = await dialog.showMessageBox(mainWindow ?? undefined, {
    type: kind === 'run' || kind === 'write' || kind === 'delete' ? 'warning' : 'question',
    buttons: ['允许', '取消'],
    defaultId: 0,
    cancelId: 1,
    title: 'endless 本机环境确认',
    message: details.title,
    detail: details.detail,
    noLink: true
  });

  if (result.response !== 0) {
    throw new Error('用户取消了本机环境操作。');
  }
}

function touchTrustedRoot(rootId) {
  const config = readDesktopLocalConfig();
  const trustedRoots = config.trustedRoots.map((root) =>
    root.id === rootId ? { ...root, lastUsedAt: Date.now() } : root
  );
  writeDesktopLocalConfig({ ...config, trustedRoots });
}

function registerDesktopLocalHostIpc() {
  ipcMain.handle('polaris-desktop-local:get-state', () => getDesktopLocalState());

  ipcMain.handle('polaris-desktop-local:set-permission-mode', (_event, mode) => {
    const config = readDesktopLocalConfig();
    return getDesktopLocalStateFromConfig(writeDesktopLocalConfig({
      ...config,
      permissionMode: mode === 'trusted' ? 'trusted' : 'confirm-each'
    }));
  });

  ipcMain.handle('polaris-desktop-local:choose-root', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: '选择 endless 本地工作区',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) {
      return getDesktopLocalState();
    }

    const selectedPath = path.resolve(result.filePaths[0]);
    const config = readDesktopLocalConfig();
    const existing = config.trustedRoots.find((root) => root.path === selectedPath);
    const now = Date.now();
    const trustedRoots = existing
      ? config.trustedRoots.map((root) =>
          root.path === selectedPath ? { ...root, lastUsedAt: now } : root
        )
      : [
          ...config.trustedRoots,
          {
            id: createDesktopRootId(),
            label: path.basename(selectedPath) || selectedPath,
            path: selectedPath,
            createdAt: now,
            lastUsedAt: now
          }
        ];

    return getDesktopLocalStateFromConfig(writeDesktopLocalConfig({
      ...config,
      trustedRoots
    }));
  });

  ipcMain.handle('polaris-desktop-local:remove-root', (_event, rootId) => {
    const config = readDesktopLocalConfig();
    return getDesktopLocalStateFromConfig(writeDesktopLocalConfig({
      ...config,
      trustedRoots: config.trustedRoots.filter((root) => root.id !== rootId)
    }));
  });

  ipcMain.handle('polaris-desktop-local:list-directory', async (_event, input) => {
    const { root, targetPath } = resolveInsideTrustedRoot(input?.rootId, input?.relativePath);
    await confirmDesktopLocalOperation('list', {
      title: '允许 endless 读取本机目录？',
      detail: targetPath
    });
    const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      relativePath: path.relative(root.path, targetPath),
      entries: entries
        .map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'
        }))
        .sort((left, right) => {
          if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : right.kind === 'directory' ? 1 : 0;
          return left.name.localeCompare(right.name);
        })
    };
  });

  ipcMain.handle('polaris-desktop-local:read-workspace-files', async (_event, input) => {
    const root = findTrustedRoot(input?.rootId);
    await confirmDesktopLocalOperation('read', {
      title: '允许 endless 同步读取本机工作区？',
      detail: `${root.path}\n\n会读取常见文本文件，并跳过 .git、node_modules、构建产物和 .polaris 元数据。`
    });
    const files = await collectDesktopWorkspaceTextFiles(root.id);
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      files
    };
  });

  ipcMain.handle('polaris-desktop-local:write-workspace-files', async (_event, input) => {
    const root = findTrustedRoot(input?.rootId);
    const files = Array.isArray(input?.files)
      ? input.files.flatMap((file) => {
          const relativePath = normalizeDesktopRelativePath(file?.relativePath);
          if (!relativePath) return [];
          return [{
            relativePath,
            content: typeof file?.content === 'string' ? file.content : ''
          }];
        })
      : [];
    if (files.length === 0) {
      throw new Error('没有可写回本机工作区的文件。');
    }
    await confirmDesktopLocalOperation('write', {
      title: '允许 endless 写回本机工作区？',
      detail: `${root.path}\n\n${files.length} 个文件会被整份写入；不会删除本机多出的文件。`
    });

    const writtenFiles = [];
    for (const file of files) {
      const { targetPath } = resolveWritableInsideTrustedRoot(root.id, file.relativePath);
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, file.content, 'utf-8');
      writtenFiles.push({
        relativePath: file.relativePath,
        bytes: Buffer.byteLength(file.content, 'utf-8')
      });
    }
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      writtenFiles
    };
  });

  ipcMain.handle('polaris-desktop-local:read-file', async (_event, input) => {
    const { root, targetPath } = resolveInsideTrustedRoot(input?.rootId, input?.relativePath);
    await confirmDesktopLocalOperation('read', {
      title: '允许 endless 读取本机文件？',
      detail: targetPath
    });
    const content = await fs.promises.readFile(targetPath, 'utf-8');
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      relativePath: path.relative(root.path, targetPath),
      content
    };
  });

  ipcMain.handle('polaris-desktop-local:write-file', async (_event, input) => {
    const content = typeof input?.content === 'string' ? input.content : '';
    const { root, targetPath } = resolveWritableInsideTrustedRoot(input?.rootId, input?.relativePath);
    await confirmDesktopLocalOperation('write', {
      title: '允许 endless 写入本机文件？',
      detail: `${targetPath}\n${Buffer.byteLength(content, 'utf-8')} bytes`
    });
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, content, 'utf-8');
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      relativePath: path.relative(root.path, targetPath),
      bytes: Buffer.byteLength(content, 'utf-8')
    };
  });

  ipcMain.handle('polaris-desktop-local:create-directory', async (_event, input) => {
    const relativePath = normalizeDesktopRelativePath(input?.relativePath);
    if (!relativePath) {
      throw new Error('文件夹路径不能为空。');
    }
    const { root, targetPath } = resolveWritableInsideTrustedRoot(input?.rootId, relativePath);
    await confirmDesktopLocalOperation('write', {
      title: '允许 endless 创建本机文件夹？',
      detail: targetPath
    });
    await fs.promises.mkdir(targetPath, { recursive: true });
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      relativePath: path.relative(root.path, targetPath)
    };
  });

  ipcMain.handle('polaris-desktop-local:delete-path', async (_event, input) => {
    const relativePath = normalizeDesktopRelativePath(input?.relativePath);
    if (!relativePath) {
      throw new Error('不能删除本机工作区根目录。');
    }
    const { root, targetPath } = resolveInsideTrustedRoot(input?.rootId, relativePath);
    const stat = await fs.promises.lstat(targetPath);
    const kind = desktopDirentKind(stat);
    await confirmDesktopLocalOperation('delete', {
      title: '允许 endless 删除本机路径？',
      detail: `${targetPath}\n\n${kind === 'directory' ? '文件夹会递归删除。' : '这个路径会从电脑上删除。'}`
    });
    await fs.promises.rm(targetPath, { recursive: true, force: false });
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      relativePath: path.relative(root.path, targetPath),
      kind
    };
  });

  ipcMain.handle('polaris-desktop-local:move-path', async (_event, input) => {
    const fromRelativePath = normalizeDesktopRelativePath(input?.fromRelativePath);
    const toRelativePath = normalizeDesktopRelativePath(input?.toRelativePath);
    if (!fromRelativePath || !toRelativePath) {
      throw new Error('移动本机路径时必须提供来源和目标路径。');
    }
    const { root, targetPath: fromPath } = resolveInsideTrustedRoot(input?.rootId, fromRelativePath);
    const { targetPath: toPath } = resolveWritableInsideTrustedRoot(root.id, toRelativePath);
    if (fromPath === root.path || toPath === root.path) {
      throw new Error('不能移动本机工作区根目录。');
    }
    if (fs.existsSync(toPath)) {
      throw new Error('目标路径已经存在。请先确认并删除或选择新的目标路径。');
    }
    const stat = await fs.promises.lstat(fromPath);
    const kind = desktopDirentKind(stat);
    await confirmDesktopLocalOperation('delete', {
      title: '允许 endless 移动本机路径？',
      detail: `${fromPath}\n-> ${toPath}`
    });
    await fs.promises.mkdir(path.dirname(toPath), { recursive: true });
    await fs.promises.rename(fromPath, toPath);
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      fromRelativePath: path.relative(root.path, fromPath),
      toRelativePath: path.relative(root.path, toPath),
      kind
    };
  });

  ipcMain.handle('polaris-desktop-local:run-command', async (_event, input) => {
    const command = typeof input?.command === 'string' ? input.command.trim() : '';
    if (!command) {
      throw new Error('命令不能为空。');
    }
    const args = Array.isArray(input?.args)
      ? input.args.map((arg) => String(arg))
      : [];
    const { root, targetPath } = resolveInsideTrustedRoot(input?.rootId, input?.cwdRelativePath);
    const stat = await fs.promises.stat(targetPath);
    if (!stat.isDirectory()) {
      throw new Error('命令工作目录必须是文件夹。');
    }
    await confirmDesktopLocalOperation('run', {
      title: '允许 endless 运行本机命令？',
      detail: `${command} ${args.join(' ')}\n\ncwd: ${targetPath}`.trim()
    });
    const startedAt = Date.now();
    const result = await runDesktopCommand(command, args, targetPath);
    touchTrustedRoot(root.id);
    return {
      ...result,
      root: { ...root, lastUsedAt: Date.now() },
      cwd: targetPath,
      cwdRelativePath: path.relative(root.path, targetPath),
      command,
      args,
      durationMs: Date.now() - startedAt
    };
  });

  ipcMain.handle('polaris-desktop-local:run-command-sequence', async (_event, input) => {
    const root = findTrustedRoot(input?.rootId);
    const steps = Array.isArray(input?.steps)
      ? input.steps.map(normalizeDesktopCommandStep)
      : [];
    if (!steps.length || steps.some((step) => !step)) {
      throw new Error('命令流程必须包含至少一个有效命令步骤。');
    }
    const continueOnError = input?.continueOnError === true;
    const plan = [];
    for (const [index, step] of steps.entries()) {
      const { targetPath } = resolveInsideTrustedRoot(root.id, step.cwdRelativePath);
      const stat = await fs.promises.stat(targetPath);
      if (!stat.isDirectory()) {
        throw new Error('命令流程的工作目录必须是文件夹。');
      }
      plan.push({
        ...step,
        index,
        cwd: targetPath,
        cwdRelativePath: path.relative(root.path, targetPath)
      });
    }
    await confirmDesktopLocalOperation('run', {
      title: '允许 endless 运行本机命令流程？',
      detail: plan.map((step) =>
        `${step.index + 1}. ${[step.command, ...step.args].join(' ')}\n   cwd: ${step.cwd}`
      ).join('\n\n')
    });
    const sequenceStartedAt = Date.now();
    const results = [];
    let stoppedAtStep = null;
    for (const step of plan) {
      const startedAt = Date.now();
      const result = await runDesktopCommand(step.command, step.args, step.cwd);
      const stepResult = {
        ...result,
        root: { ...root, lastUsedAt: Date.now() },
        index: step.index,
        ...(step.label ? { label: step.label } : {}),
        cwd: step.cwd,
        cwdRelativePath: step.cwdRelativePath,
        command: step.command,
        args: step.args,
        durationMs: Date.now() - startedAt
      };
      results.push(stepResult);
      if ((result.exitCode !== 0 || result.signal) && !continueOnError) {
        stoppedAtStep = step.index;
        break;
      }
    }
    touchTrustedRoot(root.id);
    return {
      root: { ...root, lastUsedAt: Date.now() },
      durationMs: Date.now() - sequenceStartedAt,
      continueOnError,
      stoppedAtStep,
      steps: results
    };
  });

  ipcMain.handle('polaris-desktop-local:start-command', async (_event, input) => {
    const command = typeof input?.command === 'string' ? input.command.trim() : '';
    if (!command) {
      throw new Error('命令不能为空。');
    }
    const args = Array.isArray(input?.args)
      ? input.args.map((arg) => String(arg))
      : [];
    const { root, targetPath } = resolveInsideTrustedRoot(input?.rootId, input?.cwdRelativePath);
    const stat = await fs.promises.stat(targetPath);
    if (!stat.isDirectory()) {
      throw new Error('命令工作目录必须是文件夹。');
    }
    await confirmDesktopLocalOperation('run', {
      title: '允许 endless 运行本机命令？',
      detail: `${command} ${args.join(' ')}\n\ncwd: ${targetPath}`.trim()
    });
    const session = startDesktopCommandSession({
      root,
      cwd: targetPath,
      cwdRelativePath: path.relative(root.path, targetPath),
      command,
      args
    });
    touchTrustedRoot(root.id);
    return serializeDesktopCommandSession(session);
  });

  ipcMain.handle('polaris-desktop-local:stop-command', async (_event, input) => {
    const sessionId = typeof input?.sessionId === 'string' ? input.sessionId.trim() : '';
    if (!sessionId) {
      throw new Error('终端会话 id 不能为空。');
    }
    const session = desktopCommandSessions.get(sessionId);
    if (!session) {
      throw new Error('没有找到这个终端会话。');
    }
    if (session.status === 'running') {
      session.child.kill('SIGTERM');
    }
    return serializeDesktopCommandSession(session);
  });

  ipcMain.handle('polaris-desktop-local:list-command-sessions', async () =>
    Array.from(desktopCommandSessions.values()).map(serializeDesktopCommandSession)
  );
}

function getDesktopLocalStateFromConfig(config) {
  return {
    available: true,
    platform: process.platform,
    permissionMode: config.permissionMode,
    trustedRoots: config.trustedRoots.map((root) => ({ ...root }))
  };
}

function runDesktopCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: {
        ...process.env,
        HOME: process.env.HOME || os.homedir()
      }
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      resolve({
        exitCode,
        signal,
        stdout,
        stderr
      });
    });
  });
}

function createDesktopCommandSessionId() {
  return `term_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emitDesktopCommandSessionEvent(type, session) {
  const payload = {
    type,
    session: serializeDesktopCommandSession(session)
  };
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('polaris-desktop-local:command-session', payload);
    }
  });
}

function serializeDesktopCommandSession(session) {
  return {
    id: session.id,
    root: { ...session.root, lastUsedAt: Date.now() },
    cwd: session.cwd,
    cwdRelativePath: session.cwdRelativePath,
    command: session.command,
    args: session.args,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: (session.endedAt ?? Date.now()) - session.startedAt,
    exitCode: session.exitCode,
    signal: session.signal,
    stdout: session.stdout,
    stderr: session.stderr
  };
}

function startDesktopCommandSession({ root, cwd, cwdRelativePath, command, args }) {
  const child = spawn(command, args, {
    cwd,
    shell: false,
    env: {
      ...process.env,
      HOME: process.env.HOME || os.homedir()
    }
  });
  const session = {
    id: createDesktopCommandSessionId(),
    root: { ...root, lastUsedAt: Date.now() },
    cwd,
    cwdRelativePath,
    command,
    args,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    signal: null,
    stdout: '',
    stderr: '',
    child
  };
  desktopCommandSessions.set(session.id, session);
  emitDesktopCommandSessionEvent('started', session);

  child.stdout?.on('data', (chunk) => {
    session.stdout += chunk.toString();
    emitDesktopCommandSessionEvent('output', session);
  });
  child.stderr?.on('data', (chunk) => {
    session.stderr += chunk.toString();
    emitDesktopCommandSessionEvent('output', session);
  });
  child.on('error', (error) => {
    session.status = 'failed';
    session.endedAt = Date.now();
    session.stderr += `${session.stderr ? '\n' : ''}${error instanceof Error ? error.message : String(error)}`;
    emitDesktopCommandSessionEvent('error', session);
  });
  child.on('close', (exitCode, signal) => {
    session.status = 'exited';
    session.endedAt = Date.now();
    session.exitCode = exitCode;
    session.signal = signal;
    emitDesktopCommandSessionEvent('exit', session);
  });

  return session;
}

function createStatusTray() {
  if (!KEEP_ALIVE_IN_BACKGROUND || statusTray) {
    return;
  }

  const trayIcon = createIconImage(192);
  const trayImage = trayIcon?.resize({ width: 18, height: 18 });

  if (!trayImage || trayImage.isEmpty()) {
    return;
  }

  statusTray = new Tray(trayImage);
  if (TRAY_TITLE) {
    statusTray.setTitle(TRAY_TITLE);
  }
  statusTray.setToolTip('endless 正在后台运行');
  statusTray.on('click', () => {
    showMainWindow();
  });
  updateStatusTrayMenu();
}

function applyDesktopIdentity() {
  app.setName(APP_NAME);

  const dockIcon = createIconImage(512);

  if (process.platform === 'darwin' && app.dock && dockIcon) {
    app.dock.setIcon(dockIcon);
  }

  const aboutIconPath = resolveIconPath(512);

  if (aboutIconPath) {
    app.setAboutPanelOptions({
      applicationName: APP_NAME,
      applicationVersion: app.getVersion(),
      iconPath: aboutIconPath
    });
  }
}

function updateStatusTrayMenu() {
  if (!statusTray) {
    return;
  }

  const isWindowVisible = mainWindow ? mainWindow.isVisible() : false;
  const statusLabel = isWindowVisible ? 'endless 正在运行' : 'endless 正在后台运行';

  statusTray.setToolTip(statusLabel);
  statusTray.setContextMenu(
    Menu.buildFromTemplate([
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      { label: '显示 endless', click: showMainWindow },
      {
        label: '退出 endless',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  updateStatusTrayMenu();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

app.on('before-quit', () => {
  isQuitting = true;

  if (statusTray) {
    statusTray.destroy();
    statusTray = null;
  }
});

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) {
    return;
  }

  registerDesktopLocalHostIpc();

  if (!DEV_SERVER_URL) {
    registerDesktopProtocol();
  }

  applyDesktopIdentity();
  createWindow();
  createStatusTray();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (KEEP_ALIVE_IN_BACKGROUND && !isQuitting) {
    return;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
