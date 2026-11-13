import express from 'express';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const PYTHON_BACKEND_PORT = process.env.RSIT_BACKEND_PORT || '5000';
const PYTHON_URL = `http://127.0.0.1:${PYTHON_BACKEND_PORT}`;

let pyProcess: ChildProcess | null = null;

function startPythonBackend(): void {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const appPath = path.join(__dirname, 'backend', 'app.py');

  pyProcess = spawn(pythonCmd, [appPath], {
    cwd: __dirname,
    env: {
      ...process.env,
      RSIT_BACKEND_PORT: PYTHON_BACKEND_PORT,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pyProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[python] ${chunk}`);
  });
  pyProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[python] ${chunk}`);
  });
  pyProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Python backend exited with code ${code}`);
    }
  });
}

async function waitForPythonBackend(retries = 25): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${PYTHON_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // Backend still starting up
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Python backend did not become ready in time.');
}

async function createServer() {
  startPythonBackend();
  await waitForPythonBackend();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Proxy all /api/* requests directly to the Python backend
  app.use('/api', async (req, res) => {
    const targetUrl = `${PYTHON_URL}${req.originalUrl}`;
    try {
      const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      });
      const text = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      res.send(text);
    } catch (err) {
      res.status(502).json({
        error: 'Python backend unreachable',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Railway Signal Incident Tracker running on http://0.0.0.0:${PORT}`);
  });
}

const cleanup = () => {
  if (pyProcess && !pyProcess.killed) {
    pyProcess.kill('SIGTERM');
  }
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  cleanup();
});
