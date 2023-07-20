/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';

import os from 'os';
import { promises as fs } from 'fs';
import * as util from 'node:util';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

const { exec } = require('node:child_process');

// const util = require('node:util');
const execAsync = util.promisify(exec);

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
  }
}

let mainWindow: BrowserWindow | null = null;

const isWindows = os.platform() === 'win32';
const platform = isWindows ? 'win' : 'mac';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.info('The second instance has been launched. Forced to close');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

ipcMain.on('label', async (event, data) => {
  try {
    log.info('IPC received label event', data);

    if (!mainWindow) {
      log.info('BrowserWindow is not found');
      return;
    }

    const printers = await mainWindow.webContents.getPrintersAsync();

    if (printers.length === 0) {
      const msg = 'No printers found on printing';
      log.info(msg);
      event.reply('ipc-logs', msg);
      return;
    }

    const defaultPrinter = printers.find((printer) => printer.isDefault);

    if (!defaultPrinter) {
      const msg = 'The default printer is not found';
      log.info(msg);
      event.reply('ipc-logs', msg);
      return;
    }

    event.reply(
      'ipc-logs',
      `Default printer used for printing: ${defaultPrinter.displayName}`
    );

    const parsed = JSON.parse(data);
    const isZPL = parsed.url.includes('.zpl');

    const saveFilePath = path.join(
      app.getPath('temp'),
      `${parsed.otn}-${uuidv4().substring(0, 8)}.${isZPL ? 'zpl' : 'pdf'}`
    );
    log.info(`Generated save file path ${saveFilePath}`);

    const res = await fetch(parsed.url);

    let label;
    let command;
    if (isZPL) {
      log.info('ZPL branch');
      label = await res.text();

      command = `${path.join(__dirname, '../../bin/rawprint.exe')} ${
        defaultPrinter.name
      } ${saveFilePath}`;
    } else {
      log.info('PDF branch');
      // @ts-ignore
      label = await res.buffer(); // Don't know why this works.
    }
    log.info('label', { label });

    await fs.writeFile(saveFilePath, label);

    log.info('print executing', { command });
    const { stdout, stderr, error } = await execAsync(command);
    if (error) {
      log.info('print error', stderr);
    } else {
      log.info('print result', stdout);
    }
  } catch (err) {
    if (err instanceof Error) {
      event.reply('ipc-logs', `Error: ${err.message}`);
    }
    log.error('Print handler catch', err);
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  log.info(`OS: ${os.platform()} - ${os.release()}`);

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024, // 400
    height: 728, // 700
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  const printers = await mainWindow.webContents.getPrintersAsync();

  if (printers.length > 0) {
    log.info(`Printers:`, printers);
  } else {
    log.info('No printers found on application start');
  }

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
