const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('product1Desktop', {
  getMeta: () => ipcRenderer.invoke('app:get-meta'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  reloadProduct: () => ipcRenderer.invoke('app:reload-product'),
  completeFirstRun: () => ipcRenderer.invoke('app:complete-first-run'),
  onBackendStatus: (handler) => {
    const wrapped = (_event, payload) => handler(payload);
    ipcRenderer.on('backend-status', wrapped);
    return () => ipcRenderer.removeListener('backend-status', wrapped);
  }
});
