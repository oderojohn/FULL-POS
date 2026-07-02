/**
 * Electron preload — exposes a limited contextBridge API to the renderer.
 * Keep this minimal: only expose what the frontend actually needs.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion:      () => ipcRenderer.invoke('app:version'),
  getUserDataPath: () => ipcRenderer.invoke('app:userData'),
  isPackaged:      () => ipcRenderer.invoke('app:isPackaged'),

  // Cloud sync trigger
  syncNow: () => ipcRenderer.invoke('app:syncNow'),

  // Cloud connection setup
  getMachineInfo:        () => ipcRenderer.invoke('app:getMachineInfo'),
  writeConnectionConfig: (cfg) => ipcRenderer.invoke('app:writeConnectionConfig', cfg),

  // Hardware
  getPrinters:    () => ipcRenderer.invoke('hw:getPrinters'),
  printReceipt:   (opts) => ipcRenderer.invoke('hw:printReceipt', opts),
  openCashDrawer: (opts) => ipcRenderer.invoke('hw:openCashDrawer', opts),

  // Auto-update
  onUpdateReady: (callback) => {
    ipcRenderer.on('app:updateReady', (_, info) => callback(info))
  },
  restartToUpdate: () => ipcRenderer.invoke('app:restartToUpdate'),
})
