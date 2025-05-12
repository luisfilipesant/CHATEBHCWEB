const {
  app, BrowserWindow, session, Menu, MenuItem, dialog
} = require('electron');
const { autoUpdater } = require('electron-updater');   // ← NOVO
const path = require('path');

/* ───────────────── Cria janela (principal ou pop‑up) ───────────────── */
function createWindow(url = null) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Chat EBHC',
    icon: path.join(__dirname, '../assets/icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });
  url ? win.loadURL(url) : win.loadFile(path.join(__dirname, 'index.html'));
  return win;
}

/* ──────────────── Menu de contexto “Salvar imagem como…” ────────────── */
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

      /* tenta pegar a janela; se não achar, usa foco atual */
      const win = BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow();
      menu.popup({ window: win });
    }
  });
}

/* ───── Ativa em todo webContents + trata window.open para pop‑ups ───── */
app.on('web-contents-created', (_e, c) => {
  attachSaveImageMenu(c);
  c.setWindowOpenHandler(({ url }) => (createWindow(url), { action: 'deny' }));
});

/* ─────────── Diálogo “Salvar como…” para qualquer download ──────────── */
function wireDownloads() {
  session.defaultSession.on('will-download', (e, item, wc) => {
    const win = BrowserWindow.fromWebContents(wc);
    const out = dialog.showSaveDialogSync(win, {
      title: 'Salvar arquivo',
      defaultPath: item.getFilename()
    });
    out ? item.setSavePath(out) : item.cancel();
  });
}

/* ─────────── Auto‑update: verifica, baixa e instala em silêncio ─────── */
function initAutoUpdate() {
  autoUpdater.autoDownload = true;             // baixa sem perguntar
  autoUpdater.autoInstallOnAppQuit = true;     // instala ao fechar app

  autoUpdater
    .on('checking-for-update',   () => console.log('🔎  Verificando nova versão…'))
    .on('update-available',      i => console.log(`⬇️  Baixando v${i.version}…`))
    .on('update-downloaded',     i => console.log(`✅  v${i.version} pronta – instalará na próxima abertura`))
    .on('error',                 e => console.error('⚠️  Auto‑update error:', e));

  autoUpdater.checkForUpdatesAndNotify();
}

/* ─────────── App READY ─────────── */
app.whenReady().then(() => {
  wireDownloads();
  createWindow();
  initAutoUpdate();                            // ← habilita o updater
});

/* ─────────── Boilerplate mac/Win ─────────── */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
