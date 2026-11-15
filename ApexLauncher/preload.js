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
  launch: (o) => ipcRenderer.invoke('game:launch', o || {}),
  shots: () => ipcRenderer.invoke('shots:list'),
  openShot: p => ipcRenderer.invoke('shots:open', p),
  shotsFolder: () => ipcRenderer.invoke('shots:folder'),
  openLogs: () => ipcRenderer.invoke('open:logs'),
  repair: () => ipcRenderer.invoke('game:repair'),
  stats: () => ipcRenderer.invoke('stats:get'),
  versions: () => ipcRenderer.invoke('versions:list'),
  openFolder: () => ipcRenderer.invoke('open:folder'),
  openUrl: u => ipcRenderer.invoke('open:url', u),
  onProgress: cb => ipcRenderer.on('game:progress', (_e, d) => cb(d)),
  onState: cb => ipcRenderer.on('game:state', (_e, d) => cb(d)),
  onLog: cb => ipcRenderer.on('game:log', (_e, d) => cb(d))
});
