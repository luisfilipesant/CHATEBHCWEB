const webview = document.getElementById('webview');

/* ---------- Botões de navegação ---------- */
document.getElementById('back').addEventListener('click', () => {
  if (webview.canGoBack()) webview.goBack();
});

document.getElementById('forward').addEventListener('click', () => {
  if (webview.canGoForward()) webview.goForward();
});

document.getElementById('reload').addEventListener('click', () => {
  webview.reload();
});
