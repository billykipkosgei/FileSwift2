const { contextBridge, ipcRenderer } = require('electron');
const io = require('socket.io-client');
const Peer = require('simple-peer');

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    selectFiles: () => ipcRenderer.invoke('select-files'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window')
});

// Create socket.io connection
const socket = io('http://localhost:3000');

// Expose socket.io functionality
contextBridge.exposeInMainWorld('socketAPI', {
    on: (event, callback) => socket.on(event, callback),
    emit: (event, data) => socket.emit(event, data)
});

// Expose Peer functionality
contextBridge.exposeInMainWorld('Peer', {
    createPeer: (config) => new Peer(config)
});

// Expose fs functionality
contextBridge.exposeInMainWorld('fsAPI', {
    stat: (path) => new Promise((resolve, reject) => {
        require('fs').stat(path, (err, stats) => {
            if (err) reject(err);
            else resolve({
                size: stats.size,
                isDirectory: stats.isDirectory()
            });
        });
    })
});
