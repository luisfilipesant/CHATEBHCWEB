const { app, BrowserWindow, session, Menu, MenuItem, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');       // 📒 log em arquivo
const path = require('path');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow = null;
let updateWindow = null;

/* ───── Cria janela principal ───── */
function createWindow() {
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

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.on('did-finish-load', () =>
    mainWindow.setTitle(`Chat EBHC v${app.getVersion()}`)
  );
}

/* ───── Menu de contexto imagem ───── */
function attachSaveImageMenu(contents) {
  contents.on('context-menu', (_e, p) => {
    if (p.mediaType === 'image' && p.srcURL) {
      new Menu()
        .append(new MenuItem({ label: 'Salvar imagem como…', click: () => contents.downloadURL(p.srcURL) }))
        .popup({ window: BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow() });
    }
  });
}

app.on('web-contents-created', (_e, c) => {
  attachSaveImageMenu(c);
  c.setWindowOpenHandler(({ url }) => (createWindow(), { action: 'deny' }));
});

/* ───── Download normal “Salvar como…” ───── */
session.defaultSession.on('will-download', (_e, item, wc) => {
  const out = dialog.showSaveDialogSync(BrowserWindow.fromWebContents(wc), {
    title: 'Salvar arquivo', defaultPath: item.getFilename()
  });
  out ? item.setSavePath(out) : item.cancel();
});

/* ───── Auto‑update confiável ───── */
function initAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', info => {
    log.info(`Update disponível: ${info.version}`);
    mainWindow?.hide();                              // 👉 apenas OCULTA
    updateWindow = new BrowserWindow({
      width: 420, height: 220, resizable: false, frame: true,
      alwaysOnTop: true, center: true, closable: false,
      title: 'Atualizando…',
      icon: path.join(__dirname, '../assets/icon.ico'),
      webPreferences: { contextIsolation: true }
    });

    updateWindow.loadURL(`data:text/html,
      <html><body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;font-family:sans-serif;">
        <h2 id="status">Baixando atualização…</h2>
        <p id="progress" style="margin-top:1rem;font-size:16px;">0%</p>
      </body></html>`);
  });

  autoUpdater.on('download-progress', p => {
    const pct = Math.floor(p.percent);
    log.info(`Progress: ${pct}%`);
    updateWindow?.webContents?.executeJavaScript(
      `document.getElementById('progress').innerText='${pct}%';`
    );
  });

  autoUpdater.on('update-downloaded', info => {
    log.info(`Update baixado: ${info.version}`);
    updateWindow?.webContents?.executeJavaScript(`
      document.getElementById("status").innerText = "Instalando atualização…";
      document.getElementById("progress").innerText = "Aguarde…";
    `);

    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);       // fecha, aplica, reabre
    }, 1000);
  });

  autoUpdater.on('error', err => {
    log.error('Auto‑update erro', err);
    updateWindow?.webContents?.executeJavaScript(`
      document.getElementById("status").innerText = "Erro ao atualizar";
      document.getElementById("progress").innerText = "${err.message}";
    `);
  });

  autoUpdater.checkForUpdates();
}

/* ───── Inicialização ───── */
app.whenReady().then(() => {
  createWindow();
  initAutoUpdate();
  log.info('Aplicativo iniciado – versão', app.getVersion());
});

/* ───── Boilerplate mac/Win ───── */
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
