import assert from 'node:assert/strict';
import test from 'node:test';
import type { Server } from 'node:http';
import { createApp } from './app.js';

async function withServer(run: (url: string) => Promise<void>) {
  const server = createApp().listen(0, '127.0.0.1') as Server;
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP address.');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('health endpoint is reachable without credentials and applies browser protections', async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { ok: boolean }).ok, true);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/);
  });
});


test('browser policy permits Firebase Google login without allowing arbitrary scripts or frames', async () => {
  await withServer(async (url) => {
    const response = await fetch(url);
    const directives = new Map((response.headers.get('content-security-policy') || '').split(';').map(part => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }));
    assert.deepEqual(directives.get('script-src'), ["'self'", 'https://apis.google.com']);
    assert.deepEqual(directives.get('frame-src'), ['https://body-os-1b033.firebaseapp.com']);
    for (const origin of ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com']) {
      assert.ok(directives.get('connect-src')?.includes(origin));
    }
    assert.deepEqual(directives.get('default-src'), ["'self'"]);
  });
});
