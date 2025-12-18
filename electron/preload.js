const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // LICENSE
  getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
  checkLicense: () => ipcRenderer.invoke('license:check'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),

  // UPDATER
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (cb) => {
      const listener = (e, v) => cb(v);
      ipcRenderer.on('update-status', listener);
      return () => ipcRenderer.removeListener('update-status', listener);
  },

  // SYSTEM
  onSystemLog: (cb) => {
      const listener = (e, v) => cb(v);
      ipcRenderer.on('system-log', listener);
      return () => ipcRenderer.removeListener('system-log', listener);
  },
  getFonts: () => ipcRenderer.invoke('system:getFonts'),

  // DIALOGS
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: () => ipcRenderer.invoke('dialog:saveFile'),

  // TOOLS
  rename: (args) => ipcRenderer.invoke('backend:rename', args),
  stopRename: () => ipcRenderer.invoke('backend:stopRename'),
  
  deleteShort: (args) => ipcRenderer.invoke('backend:deleteShort', args),
  stopDelete: () => ipcRenderer.invoke('backend:stopDelete'),
  onDeleteProgress: (cb) => {
      const listener = (e, v) => cb(v);
      ipcRenderer.on('delete-progress', listener);
      return () => ipcRenderer.removeListener('delete-progress', listener);
  },

  startDedup: (args) => ipcRenderer.invoke('backend:startDedup', args),
  stopDedup: () => ipcRenderer.invoke('backend:stopDedup'),
  onDedupProgress: (cb) => {
      const listener = (e, v) => cb(v);
      ipcRenderer.on('dedup-progress', listener);
      return () => ipcRenderer.removeListener('dedup-progress', listener);
  },

  convert9to16: (args) => ipcRenderer.invoke('backend:convert9to16', args),
  stopConvert9to16: () => ipcRenderer.invoke('backend:stopConvert9to16'),

  checkMax: (args) => ipcRenderer.invoke('backend:checkMax', args),
  merge: (args) => ipcRenderer.invoke('backend:merge', args),
  stopMerge: () => ipcRenderer.invoke('backend:stopMerge'),

  // --- NEW: SYNC VIDEO (ĐÃ FIX) ---
  analyzeSync: (data) => ipcRenderer.invoke('backend:analyzeSync', data),
  
  // FIX LỖI Ở ĐÂY: Trả về hàm removeListener để React không bị crash
  onSyncProgress: (cb) => {
      const listener = (e, v) => cb(v);
      ipcRenderer.on('sync-progress', listener);
      return () => ipcRenderer.removeListener('sync-progress', listener);
  },

  // --- NEW: SYNC VIDEO (RENDER) ---
  renderSync: (data) => ipcRenderer.invoke('backend:renderSync', data),
  onRenderProgress: (cb) => {
      const listener = (e, v) => cb(v);
      ipcRenderer.on('render-progress', listener);
      return () => ipcRenderer.removeListener('render-progress', listener);
  },

  // TTS
  checkTTSConnection: (url) => ipcRenderer.invoke('tts:checkConnection', url),
  startTTS: (config) => ipcRenderer.invoke('backend:startTTS', config),
  onTTSProgress: (cb) => {
      const listener = (e, v) => cb(v);
      ipcRenderer.on('tts-progress', listener);
      return () => ipcRenderer.removeListener('tts-progress', listener);
  },
  startServer: (data) => ipcRenderer.invoke('tts:startServer', data),
  stopServer: () => ipcRenderer.invoke('tts:stopServer'),
});