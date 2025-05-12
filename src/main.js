const { app, BrowserWindow, session, Menu, MenuItem, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow = null;
let updateWindow = null;

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

/* ─────────────── Auto‑update com barra de progresso ─────────────── */
function initAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('🔎 Verificando nova versão...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`⬇️ Baixando v${info.version}...`);

    updateWindow = new BrowserWindow({
      width: 420,
      height: 220,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      title: 'Atualizando...',
      frame: true,
      alwaysOnTop: true,
      center: true,
      icon: path.join(__dirname, '../assets/icon.ico'),
      webPreferences: {
        contextIsolation: true
      }
    });

    updateWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head><meta charset="UTF-8"><title>Atualizando...</title></head>
        <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;font-family:sans-serif;">
          <h2 id="status">Atualizando app... aguarde</h2>
          <p id="progress" style="margin-top:1rem;font-size:16px;">0%</p>
        </body>
      </html>`);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.floor(progressObj.percent);
    console.log(`📦 Download: ${percent}%`);

    if (updateWindow && updateWindow.webContents) {
      updateWindow.webContents.executeJavaScript(
        `document.getElementById("progress").innerText = "${percent}%";`
      );
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`✅ v${info.version} baixada – instalará na próxima abertura`);

    if (updateWindow && updateWindow.webContents) {
      updateWindow.webContents.executeJavaScript(`
        document.getElementById("status").innerText = "Atualização concluída!";
        document.getElementById("progress").innerText = "Reinicie o app para aplicar.";
      `);
    }

    // Fecha o modal após 3 segundos
    setTimeout(() => {
      if (updateWindow) updateWindow.close();
    }, 3000);
  });

  autoUpdater.on('error', (err) => {
    console.error('⚠️ Erro no auto-update:', err);

    if (updateWindow && updateWindow.webContents) {
      updateWindow.webContents.executeJavaScript(`
        document.getElementById("status").innerText = "Erro ao atualizar.";
        document.getElementById("progress").innerText = "${err.message}";
      `);
    }

    setTimeout(() => {
      if (updateWindow) updateWindow.close();
    }, 5000);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

/* ─────────────── App pronto ─────────────── */
app.whenReady().then(() => {
  wireDownloads();
  createWindow();
  initAutoUpdate();
});

/* ─────────────── Boilerplate mac / Win ─────────────── */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
