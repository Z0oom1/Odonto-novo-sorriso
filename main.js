const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Handlers para controle de janela customizado
ipcMain.on('window-min', () => mainWindow?.minimize());
ipcMain.on('window-max', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// Otimizações extremas para PCs antigos e de baixo desempenho
app.disableHardwareAcceleration(); // Desabilita GPU
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256'); // Limite de 256MB RAM pro V8

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'img/logo.png'),
    backgroundColor: '#ffffff', // Evita flash branco no carregamento
    show: false, // Só mostra quando estiver pronto
    frame: false, // Remove a barra de título padrão
    webPreferences: {
      nodeIntegration: true, // Habilitado para controles de janela (IPC)
      contextIsolation: false, // Simplificado para este projeto interno
      backgroundThrottling: true // Reduz uso de CPU em segundo plano
    }
  });

  // Carrega a URL do servidor local (iniciado no main process)
  mainWindow.loadURL('http://localhost:3000/desktop/index.html').catch(() => {
    console.log("Falha ao carregar. Tentando novamente em 2s...");
    setTimeout(() => mainWindow.loadURL('http://localhost:3000/desktop/index.html'), 2000);
  });
  
  // Ocultar menu padrão
  mainWindow.setMenuBarVisibility(false);

  // Exibir apenas quando estiver pronto para renderizar
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  // Inicia o servidor Express embutido no processo Electron
  try {
    require('./server.js');
    console.log("Servidor embutido carregado com sucesso.");
  } catch (err) {
    console.error("Erro ao iniciar servidor:", err);
  }

  // Espera um pouco mais para garantir que a porta 3000 abriu antes de carregar
  setTimeout(createWindow, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
