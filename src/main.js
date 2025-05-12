const { app, BrowserWindow, session, Menu, MenuItem, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow = null;
let updateWindow = null;

/* ────────────── Cria janela principal ────────────── */
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

  mainWindow.webContents.on('did-finish-load', () =>
    mainWindow.setTitle(`Chat EBHC v${app.getVersion()}`)
  );

  url
    ? mainWindow.loadURL(url)
    : mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

/* ────── Menu “Salvar imagem como…” ────── */
function attachSaveImageMenu(contents) {
  contents.on('context-menu', (_e, p) => {
    if (p.mediaType === 'image' && p.srcURL) {
      new Menu()
        .append(new MenuItem({
          label: 'Salvar imagem como…',
          click: () => contents.downloadURL(p.srcURL)
        }))
        .popup({ window: BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow() });
    }
  });
}

app.on('web-contents-created', (_e, c) => {
  attachSaveImageMenu(c);
  c.setWindowOpenHandler(({ url }) => (createWindow(url), { action: 'deny' }));
});

/* ────── “Salvar como…” para downloads regulares ────── */
function wireDownloads() {
  session.defaultSession.on('will-download', (_e, item, wc) => {
    const out = dialog.showSaveDialogSync(
      BrowserWindow.fromWebContents(wc),
      { title: 'Salvar arquivo', defaultPath: item.getFilename() }
    );
    out ? item.setSavePath(out) : item.cancel();
  });
}

/* ────────── Auto‑update confiável ────────── */
function initAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', info => {
    console.log(`⬇️ Baixando v${info.version}…`);

    mainWindow?.close();                // libera arquivos usados

    updateWindow = new BrowserWindow({
      width: 420, height: 220, frame: true, alwaysOnTop: true,
      center: true, resizable: false, minimizable: false, maximizable: false,
      closable: false, title: 'Atualizando…',
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
    console.log(`📥 ${pct}%`);
    if (updateWindow?.webContents) {
      updateWindow.webContents.executeJavaScript(
        `document.getElementById('progress').innerText='${pct}%';`
      );
    }
  });

  /* download concluído com sucesso */
  autoUpdater.on('update-downloaded', info => {
    console.log(`✅ v${info.version} baixada – instalando…`);

    updateWindow?.webContents?.executeJavaScript(`
      document.getElementById("status").innerText = "Instalando atualização…";
      document.getElementById("progress").innerText = "Aguarde…";
    `);

    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);   // fecha, aplica patch e reabre
    }, 1200);
  });

  autoUpdater.on('error', err => {
    console.error('⚠️ Auto‑update erro:', err);
    updateWindow?.webContents?.executeJavaScript(`
      document.getElementById("status").innerText = "Erro ao atualizar";
      document.getElementById("progress").innerText = "${err.message}";
    `);
  });

  autoUpdater.checkForUpdates();                // checa já na inicialização
}

/* ────── Inicialização ────── */
app.whenReady().then(() => {
  wireDownloads();
  createWindow();
  initAutoUpdate();
});

/* ────── Boilerplate mac / Win ────── */
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
