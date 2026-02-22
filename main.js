const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: true
        },
        // Optional: Remove the top menu bar for a "game" feel
        autoHideMenuBar: true,
        fullscreen: false 
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});