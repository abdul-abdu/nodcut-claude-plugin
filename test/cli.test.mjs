// Runs the CLI as Claude would: the offline mock end to end, then the real HTTP client
// against a small fake of the sites API (API.md). `node --test test/`
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../plugins/nodcut/scripts/nodcut.mjs', import.meta.url));

function run(args, env) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, out: stdout + stderr });
    });
  });
}

async function makeSite(root) {
  await mkdir(join(root, 'assets'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'x'), { recursive: true });
  await mkdir(join(root, '.git'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<h1>Salom</h1>');
  await writeFile(join(root, 'assets', 'app.js'), 'console.log(1)');
  await writeFile(join(root, '.env'), 'SECRET=1');
  await writeFile(join(root, '.git', 'HEAD'), 'ref');
  await writeFile(join(root, 'node_modules', 'x', 'i.js'), '');
  return root;
}

test('mock: sign in, deploy, pay, live', async () => {
  const home = await mkdtemp(join(tmpdir(), 'nodcut-home-'));
  const site = await makeSite(await mkdtemp(join(tmpdir(), 'nodcut-site-')));
  const env = { NODCUT_API: 'mock', NODCUT_HOME: home, NODCUT_MOCK_PAY_MS: '0' };

  let r = await run(['deploy', site, '--name', 'my-shop'], env);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /Not signed in/);

  r = await run(['login'], env);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Signed in as Mock User/);
  assert.equal((await stat(join(home, 'credentials.mock.json'))).mode & 0o777, 0o600);

  r = await run(['check', 'admin'], env);
  assert.equal(r.code, 1);
  assert.match(r.out, /reserved/);
  r = await run(['check', 'bad-'], env);
  assert.equal(r.code, 1);
  assert.match(r.out, /not a valid name/);
  r = await run(['check', 'my-shop'], env);
  assert.equal(r.code, 0, r.out);

  r = await run(['deploy', site, '--name', 'taken-site'], env);
  assert.equal(r.code, 1);
  assert.match(r.out, /name_taken/);

  r = await run(['deploy', site, '--name', 'my-shop'], env);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Files: 2 /);
  assert.match(r.out, /Pay 15 000 so'm/);
  const id = r.out.match(/Deploy: (\S+)/)[1];

  r = await run(['wait', id], env);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Live: file:/);

  const live = join(home, 'mock', 'sites', 'my-shop');
  assert.equal(await readFile(join(live, 'index.html'), 'utf8'), '<h1>Salom</h1>');
  assert.equal(await readFile(join(live, 'assets', 'app.js'), 'utf8'), 'console.log(1)');
  await assert.rejects(stat(join(live, '.env')));
  await assert.rejects(stat(join(live, 'node_modules')));

  r = await run(['sites'], env);
  assert.match(r.out, /my-shop/);
});

test('deploy refuses a folder without index.html', async () => {
  const home = await mkdtemp(join(tmpdir(), 'nodcut-home-'));
  const site = await mkdtemp(join(tmpdir(), 'nodcut-site-'));
  await writeFile(join(site, 'about.html'), 'x');
  const env = { NODCUT_API: 'mock', NODCUT_HOME: home };
  await run(['login'], env);
  const r = await run(['deploy', site, '--name', 'my-shop'], env);
  assert.equal(r.code, 1);
  assert.match(r.out, /No index.html/);
});

test('http: talks the API.md contract', async () => {
  const puts = new Map();
  const seen = [];
  let polls = 0;
  let base;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const json = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    seen.push(`${req.method} ${req.url}`);
    const authed = req.headers.authorization === 'Bearer t0k';
    if (req.method === 'POST' && req.url === '/sites/cli-login') {
      return json(200, { code: 'ABCD-1234', url: 'https://app.nodcut.com/cli?code=ABCD-1234', interval: 1, expires_in: 600 });
    }
    if (req.method === 'GET' && req.url === '/sites/cli-login/ABCD-1234') {
      return polls++ === 0
        ? json(202, { status: 'pending' })
        : json(200, { token: 't0k', expires_at: '2099-01-01T00:00:00Z', user: { id: 42, name: 'Ali' } });
    }
    if (req.method === 'PUT' && req.url.startsWith('/put/')) {
      puts.set(req.url.slice(5), { body: body.toString(), type: req.headers['content-type'] });
      res.writeHead(200);
      return res.end();
    }
    if (!authed) return json(401, { error: 'unauthorized', message: 'no' });
    if (req.method === 'POST' && req.url === '/sites/deploys') {
      const { name, files } = JSON.parse(body);
      assert.equal(name, 'ali-shop');
      return json(201, {
        deploy_id: 'd1',
        uploads: files.map((f) => ({
          path: f.path,
          url: `${base}/put/${f.path}`,
          headers: { 'Content-Type': f.path.endsWith('.html') ? 'text/html' : 'text/javascript' },
        })),
      });
    }
    if (req.method === 'POST' && req.url === '/sites/deploys/d1/uploaded') {
      return json(200, { pay_url: 'https://checkout.paycom.uz/xyz', amount_uzs: 15000, order_id: '7' });
    }
    if (req.method === 'GET' && req.url === '/sites/deploys/d1') {
      return json(200, { deploy_id: 'd1', name: 'ali-shop', state: 'published', url: 'https://ali-shop.nodcut.com', expires_at: '2027-11-19T00:00:00Z' });
    }
    json(404, { error: 'not_found', message: req.url });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await mkdtemp(join(tmpdir(), 'nodcut-home-'));
    const site = await makeSite(await mkdtemp(join(tmpdir(), 'nodcut-site-')));
    const env = { NODCUT_API_URL: `${base}/sites`, NODCUT_HOME: home };

    let r = await run(['login', '--no-open'], env);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Signed in as Ali/);

    r = await run(['deploy', site, '--name', 'ali-shop', '--no-open'], env);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /https:\/\/checkout\.paycom\.uz\/xyz/);
    assert.deepEqual([...puts.keys()].sort(), ['assets/app.js', 'index.html']);
    assert.equal(puts.get('index.html').type, 'text/html');
    assert.equal(puts.get('index.html').body, '<h1>Salom</h1>');

    r = await run(['wait', 'd1'], env);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /Live: https:\/\/ali-shop\.nodcut\.com/);

    // the session is per server: a different API URL starts signed out
    r = await run(['sites'], { ...env, NODCUT_API_URL: `${base}/other` });
    assert.equal(r.code, 2, r.out);
  } finally {
    server.close();
  }
});
