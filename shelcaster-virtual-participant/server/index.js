import { WebSocketServer } from './websocket-server.js';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3001;

console.log('Starting Shelcaster Virtual Participant...');

// Launch Puppeteer
const launchOptions = {
  pipe: true,
  dumpio: true,
  headless: true,
  devtools: false,
  handleSIGHUP: false,
  handleSIGINT: false,
  handleSIGTERM: false,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--incognito',
    '--no-pings',
    '--no-zygote',
    '--no-sandbox',
    '--no-first-run',
    '--no-experiments',
    '--disable-gpu',
    '--disable-zero-copy',
    '--disable-dev-tools',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--disable-software-rasterizer',
    '--disable-site-isolation-trials',
    '--disable-accelerated-video-encode',
    '--disable-accelerated-video-decode',
    '--enable-features=NetworkService',
    '--autoplay-policy=no-user-gesture-required',
    '--renderer-process-limit=1',
    "--proxy-server='direct://'",
    '--proxy-bypass-list=*'
  ]
};

async function startVirtualParticipant() {
  try {
    // Start WebSocket server
    const wsServer = new WebSocketServer(PORT);
    console.log(`WebSocket server started on port ${PORT}`);

    // Launch browser
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Expose functions to the page
    await page.exposeFunction('sendMessage', (message) => {
      wsServer.broadcastToClients(message);
    });

    // Handle console messages from the page
    page.on('console', (msg) => {
      const type = msg.type().toUpperCase();
      console.log(`[BROWSER ${type}]`, msg.text());
    });

    // Load the client application
    const clientPath = join(__dirname, '../client/index.html');
    await page.goto(`file://${clientPath}`, { waitUntil: 'networkidle2' });

    console.log('Virtual participant client loaded');

    // Handle shutdown signals
    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down...`);
        await page.close({ runBeforeUnload: true });
        await browser.close();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Error starting virtual participant:', error);
    process.exit(1);
  }
}

startVirtualParticipant();

