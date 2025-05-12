const {
  app,
  BrowserWindow,
  session,
  Menu,
  MenuItem,
  dialog,
} = require('electron');
const path = require('path');

/* ─────────────── Cria janela (principal ou pop‑up) ─────────────── */
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
      webviewTag: true,
    },
  });

  url ? win.loadURL(url) : win.loadFile(path.join(__dirname, 'index.html'));
  return win;
}

/* ─────────────── Menu de contexto “Salvar imagem como…” ────────── */
function attachSaveImageMenu(contents) {
  contents.on('context-menu', (_e, params) => {
    if (params.mediaType === 'image' && params.srcURL) {
      const menu = new Menu();
      menu.append(
        new MenuItem({
          label: 'Salvar imagem como…',
          click: () => contents.downloadURL(params.srcURL),
        })
      );
      menu.popup({ window: BrowserWindow.fromWebContents(contents) });
    }
  });
}

/* ─────────────── Ativa em TODO webContents + trata window.open ─── */
app.on('web-contents-created', (_event, contents) => {
  attachSaveImageMenu(contents);

  // intercepta window.open
  contents.setWindowOpenHandler(({ url }) => {
    createWindow(url);            // cria nova janela com preload e menu
    return { action: 'deny' };    // cancela janela padrão do Electron
  });
});

/* ─────────────── Diálogo “Salvar como…” para downloads ─────────── */
app.whenReady().then(() => {
  session.defaultSession.on('will-download', (event, item, wc) => {
    const win = BrowserWindow.fromWebContents(wc);
    const filePath = dialog.showSaveDialogSync(win, {
      title: 'Salvar arquivo',
      defaultPath: item.getFilename(),
    });
    filePath ? item.setSavePath(filePath) : item.cancel();
  });

  createWindow();                 // janela principal
});

/* ─────────────── Comportamento padrão de apps mac/Win ──────────── */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
