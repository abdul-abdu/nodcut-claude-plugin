#!/usr/bin/env node
// NodCut sites CLI, run by the nodcut Claude Code plugin's skills. Node 18+, no dependencies.
//
//   nodcut.mjs login [--no-open] [--timeout 540]
//   nodcut.mjs logout | whoami
//   nodcut.mjs check <name>
//   nodcut.mjs deploy <dir> --name <name> [--no-open]   uploads, then prints the Payme link
//   nodcut.mjs wait <deploy_id> [--timeout 540]         until the site is live
//   nodcut.mjs status <deploy_id>
//   nodcut.mjs sites
//
// Exit codes: 0 done, 1 error, 2 not signed in, 3 still waiting (run it again), 4 payment cancelled.
// Env: NODCUT_API_URL (default https://api.nodcut.com/sites), NODCUT_API=mock (offline),
// NODCUT_HOME (default ~/.config/nodcut, where the session is saved).
import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ApiError, NotLoggedIn, collectFiles, httpApi, validName } from './api.mjs';
import { mockApi } from './mock.mjs';

const HOME = process.env.NODCUT_HOME || join(homedir(), '.config', 'nodcut');
const MOCK = process.env.NODCUT_API === 'mock';
const API_URL = (process.env.NODCUT_API_URL || 'https://api.nodcut.com/sites').replace(/\/+$/, '');
const CREDS = join(HOME, MOCK ? 'credentials.mock.json' : 'credentials.json');
const SELF = process.argv[1];

const EXIT = { ok: 0, error: 1, login: 2, waiting: 3, cancelled: 4 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (line = '') => process.stdout.write(`${line}\n`);
const uzs = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const kb = (bytes) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const day = (iso) => (iso ? iso.slice(0, 10) : '?');

class Usage extends Error {}

async function loadCreds() {
  try {
    const creds = JSON.parse(await readFile(CREDS, 'utf8'));
    if (creds.api !== (MOCK ? 'mock' : API_URL)) return null; // saved for another server
    if (creds.expires_at && Date.parse(creds.expires_at) <= Date.now()) return null;
    return creds;
  } catch {
    return null;
  }
}

async function saveCreds(creds) {
  await mkdir(HOME, { recursive: true, mode: 0o700 });
  await writeFile(CREDS, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await chmod(CREDS, 0o600);
}

function api(token) {
  return MOCK ? mockApi(HOME, token) : httpApi(API_URL, token);
}

async function authed() {
  const creds = await loadCreds();
  if (!creds) throw new NotLoggedIn();
  return api(creds.token);
}

function openUrl(url) {
  if (MOCK) return;
  const os = platform();
  const [cmd, args] =
    os === 'darwin' ? ['open', [url]] : os === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // no browser: the link is printed anyway
  }
}

async function login(opts) {
  const client = api(null);
  const start = await client.startLogin();
  say(`Sign in to NodCut and click Allow:`);
  say(`  ${start.url}`);
  say(`Code: ${start.code}`);
  if (!opts['no-open']) openUrl(start.url);
  const deadline = Date.now() + Math.min(Number(opts.timeout) || 540, start.expires_in || 600) * 1000;
  const interval = Math.max(1, start.interval || 2) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval);
    const r = await client.pollLogin(start.code);
    if (r.status === 'approved') {
      await saveCreds({ api: MOCK ? 'mock' : API_URL, token: r.token, expires_at: r.expires_at, user: r.user });
      say(`Signed in as ${r.user?.name ?? r.user?.id}.`);
      return EXIT.ok;
    }
    if (r.status === 'denied') {
      say('Sign-in was denied in the browser.');
      return EXIT.error;
    }
    if (r.status === 'expired') {
      say('The sign-in code expired. Run login again.');
      return EXIT.error;
    }
  }
  say('Still waiting for the browser sign-in. Run login again when ready.');
  return EXIT.waiting;
}

async function whoami() {
  const creds = await loadCreds();
  if (!creds) throw new NotLoggedIn();
  say(`Signed in as ${creds.user?.name ?? '?'} (id ${creds.user?.id ?? '?'}), session until ${day(creds.expires_at)}.`);
  return EXIT.ok;
}

async function logout() {
  await rm(CREDS, { force: true });
  say('Signed out.');
  return EXIT.ok;
}

async function check(name) {
  if (!name) throw new Usage('check needs a name');
  if (!validName(name)) {
    say(`"${name}" is not a valid name: use 3–40 characters, a-z, 0-9 and "-" (not at the start or end).`);
    return EXIT.error;
  }
  const r = await (await authed()).checkName(name);
  say(r.available ? `${name}.nodcut.com is available.` : `${name}.nodcut.com is not available (${r.reason}).`);
  return r.available ? EXIT.ok : EXIT.error;
}

async function deploy(dir, opts) {
  if (!dir) throw new Usage('deploy needs the site folder');
  const name = opts.name;
  if (!name) throw new Usage('deploy needs --name');
  if (!validName(name)) {
    say(`"${name}" is not a valid name: use 3–40 characters, a-z, 0-9 and "-" (not at the start or end).`);
    return EXIT.error;
  }
  const root = resolve(dir);
  if (!(await stat(root).catch(() => null))?.isDirectory()) {
    say(`${root} is not a folder.`);
    return EXIT.error;
  }
  const { files, links } = await collectFiles(root);
  if (!files.some((f) => f.path === 'index.html')) {
    say(`No index.html at the top of ${root}. Build the site first, or pass the folder that holds index.html.`);
    return EXIT.error;
  }
  const client = await authed();
  const total = files.reduce((n, f) => n + f.size, 0);
  say(`Site: ${root}`);
  say(`Files: ${files.length} (${kb(total)})`);
  if (links.length) say(`Skipped symlinks: ${links.join(', ')}`);

  const created = await client.createDeploy(name, files);
  const byPath = new Map(files.map((f) => [f.path, f]));
  const queue = [...created.uploads];
  async function worker() {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const file = byPath.get(u.path);
      if (!file) throw new ApiError(0, 'upload_failed', `The server asked for ${u.path}, which is not in the site.`);
      await client.upload(u, file.abs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
  say(`Uploaded ${created.uploads.length} files.`);

  const pay = await client.uploaded(created.deploy_id);
  say('');
  say(`Deploy: ${created.deploy_id}`);
  say(`Pay ${uzs(pay.amount_uzs)} so'm with Payme to publish https://${name}.nodcut.com for 1 year:`);
  say(`  ${pay.pay_url}`);
  say(`Then run: node "${SELF}" wait ${created.deploy_id}`);
  if (!opts['no-open']) openUrl(pay.pay_url);
  return EXIT.ok;
}

function describe(d) {
  switch (d.state) {
    case 'uploading':
      return 'Files are still uploading.';
    case 'awaiting_payment':
      return 'Waiting for the Payme payment.';
    case 'paid':
      return 'Paid. Publishing…';
    case 'published':
      return `Live: ${d.url}\nPaid until ${day(d.expires_at)}. It will be deleted after that unless it is deployed again.`;
    case 'cancelled':
      return 'The payment was cancelled or timed out. Run deploy again to get a new payment link.';
    case 'failed':
      return `Publishing failed: ${d.error ?? 'unknown error'}`;
    default:
      return `State: ${d.state}`;
  }
}

const exitFor = (d) =>
  d.state === 'published' ? EXIT.ok : d.state === 'cancelled' ? EXIT.cancelled : d.state === 'failed' ? EXIT.error : EXIT.waiting;

async function status(id) {
  if (!id) throw new Usage('status needs a deploy id');
  const d = await (await authed()).getDeploy(id);
  say(describe(d));
  return exitFor(d);
}

async function wait(id, opts) {
  if (!id) throw new Usage('wait needs a deploy id');
  const client = await authed();
  const deadline = Date.now() + (Number(opts.timeout) || 540) * 1000;
  let last = null;
  for (;;) {
    const d = await client.getDeploy(id);
    if (d.state !== last) {
      say(describe(d));
      last = d.state;
    }
    const code = exitFor(d);
    if (code !== EXIT.waiting) return code;
    if (Date.now() >= deadline) {
      say(`Still waiting. Run: node "${SELF}" wait ${id}`);
      return EXIT.waiting;
    }
    await sleep(3000);
  }
}

async function sites() {
  const { sites: list } = await (await authed()).listSites();
  if (!list.length) {
    say('No sites yet.');
    return EXIT.ok;
  }
  for (const s of list) say(`${s.url}  ${s.state}  paid until ${day(s.expires_at)}`);
  return EXIT.ok;
}

async function main(argv) {
  const { values: opts, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      timeout: { type: 'string' },
      'no-open': { type: 'boolean' },
    },
  });
  const [command, arg] = positionals;
  switch (command) {
    case 'login':
      return login(opts);
    case 'logout':
      return logout();
    case 'whoami':
      return whoami();
    case 'check':
      return check(arg);
    case 'deploy':
      return deploy(arg, opts);
    case 'wait':
      return wait(arg, opts);
    case 'status':
      return status(arg);
    case 'sites':
      return sites();
    default:
      throw new Usage(command ? `unknown command "${command}"` : 'no command');
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    if (e instanceof NotLoggedIn) {
      say(`${e.message} Run: node "${SELF}" login`);
      process.exit(EXIT.login);
    }
    if (e instanceof ApiError) {
      say(`Error (${e.code}): ${e.message}`);
      if (Array.isArray(e.body?.files)) say(`Files: ${e.body.files.slice(0, 20).join(', ')}`);
      process.exit(EXIT.error);
    }
    if (e instanceof Usage || e?.code?.startsWith?.('ERR_PARSE_ARGS')) {
      say(`Usage error: ${e.message}. Commands: login, logout, whoami, check, deploy, wait, status, sites.`);
      process.exit(EXIT.error);
    }
    say(`Error: ${e?.message ?? e}`);
    process.exit(EXIT.error);
  },
);
