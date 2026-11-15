const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apex', {
  minimize: () => ipcRenderer.send('win:min'),
  close: () => ipcRenderer.send('win:close'),
  info: () => ipcRenderer.invoke('app:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: s => ipcRenderer.invoke('settings:set', s),
  getAccount: () => ipcRenderer.invoke('account:get'),
  login: () => ipcRenderer.invoke('account:login'),
  logout: () => ipcRenderer.invoke('account:logout'),
  launch: () => ipcRenderer.invoke('game:launch'),
  openFolder: () => ipcRenderer.invoke('open:folder'),
  openUrl: u => ipcRenderer.invoke('open:url', u),
  onProgress: cb => ipcRenderer.on('game:progress', (_e, d) => cb(d)),
  onState: cb => ipcRenderer.on('game:state', (_e, d) => cb(d)),
  onLog: cb => ipcRenderer.on('game:log', (_e, d) => cb(d))
});
