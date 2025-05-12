const { app, BrowserWindow, session, Menu, MenuItem, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

/* ────────────── Referência global da janela principal ────────────── */
let mainWindow = null;

/* ────────────── Cria janela principal ou pop‑up ────────────── */
function createWindow(url = null) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: `Chat EBHC v${app.getVersion()}`,
    icon: path.join(__dirname, '../assets/icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  url ? mainWindow.loadURL(url)
      : mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });

  return mainWindow;
}

/* ────────────── Menu de contexto “Salvar imagem como…” ────────────── */
function attachSaveImageMenu(contents) {
  contents.on('context-menu', (_e, params) => {
    if (params.mediaType === 'image' && params.srcURL) {
      const menu = new Menu();
      menu.append(
        new MenuItem({
          label: 'Salvar imagem como…',
          click: () => contents.downloadURL(params.srcURL)
        })
      );

      const win = BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow();
      menu.popup({ window: win });
    }
  });
}

/* ───── Ativa menu em todos os webContents + trata window.open ───── */
app.on('web-contents-created', (_e, c) => {
  attachSaveImageMenu(c);
  c.setWindowOpenHandler(({ url }) => (createWindow(url), { action: 'deny' }));
});

/* ─────────────── Diálogo “Salvar como…” para downloads ─────────────── */
function wireDownloads() {
  session.defaultSession.on('will-download', (_e, item, wc) => {
    const win = BrowserWindow.fromWebContents(wc);
    const out = dialog.showSaveDialogSync(win, {
      title: 'Salvar arquivo',
      defaultPath: item.getFilename()
    });
    out ? item.setSavePath(out) : item.cancel();
  });
}

/* ─────────────── Auto‑update com tela de progresso ─────────────── */
function initAutoUpdate() {
  let updateWindow = null;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('🔎 Verificando nova versão...');
  });

  autoUpdater.on('update-available', info => {
    console.log(`⬇️ Baixando v${info.version}...`);

    updateWindow = new BrowserWindow({
      width: 400,
      height: 200,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      title: 'Atualizando...',
      frame: true,
      alwaysOnTop: true,
      center: true,
      icon: path.join(__dirname, '../assets/icon.ico'),
      webPreferences: { contextIsolation: true }
    });

    updateWindow.loadURL(`data:text/html,
      <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100%;font-family:sans-serif;">
          <h2>Atualizando app... aguarde</h2>
        </body>
      </html>`);
  });

  autoUpdater.on('update-downloaded', info => {
    console.log(`✅ v${info.version} baixada – instalará na próxima abertura`);
    if (updateWindow) updateWindow.close();
  });

  autoUpdater.on('error', err => {
    console.error('⚠️ Erro no auto-update:', err);
    if (updateWindow) updateWindow.close();
  });

  autoUpdater.checkForUpdatesAndNotify();
}

/* ─────────────── App pronto ─────────────── */
app.whenReady().then(() => {
  wireDownloads();
  createWindow();     // cria a janela principal
  initAutoUpdate();   // verifica atualizações
});

/* ─────────────── Boilerplate mac / Win ─────────────── */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
