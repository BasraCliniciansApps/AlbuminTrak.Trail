'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.sendSync('data:load'),
  save: (records) => ipcRenderer.send('data:save', records),
  importCloud: () => ipcRenderer.invoke('import:cloud'),
  importFile: () => ipcRenderer.invoke('import:file'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),
  openFolder: () => ipcRenderer.invoke('folder:open'),
  onBackup: (cb) => ipcRenderer.on('backup:done', (_e, info) => cb(info))
});
