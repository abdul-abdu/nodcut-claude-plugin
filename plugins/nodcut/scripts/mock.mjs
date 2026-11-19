// An offline stand-in for the sites API (NODCUT_API=mock), same methods as httpApi.
// State lives in <home>/mock/: login approves itself, payment "arrives" NODCUT_MOCK_PAY_MS
// after the upload finishes (default 3 s), and a published site is a folder you can open.
import { copyFile, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ApiError, NotLoggedIn, validName } from './api.mjs';

const RESERVED = new Set(['www', 'app', 'admin', 'api', 'mail', 'sites', 'static', 'cdn', 'help', 'support', 'status']);
const TAKEN = new Set(['taken-site']); // owned by someone else, for trying the error path
const PRICE_UZS = 15000;
const YEAR_MS = 365 * 24 * 3600 * 1000;

export function mockApi(home, token) {
  const dir = join(home, 'mock');
  const stateFile = join(dir, 'state.json');
  const payMs = Number(process.env.NODCUT_MOCK_PAY_MS ?? 3000);

  async function load() {
    try {
      return JSON.parse(await readFile(stateFile, 'utf8'));
    } catch {
      return { seq: 0, logins: {}, deploys: {}, sites: {} };
    }
  }
  async function save(state) {
    await mkdir(dir, { recursive: true });
    await writeFile(stateFile, JSON.stringify(state, null, 2));
  }
  function auth() {
    if (!token) throw new NotLoggedIn();
  }
  const siteDir = (name) => join(dir, 'sites', name);
  const siteUrl = (name) => pathToFileURL(join(siteDir(name), 'index.html')).href;
  function nameProblem(state, name) {
    if (!validName(name)) return 'invalid';
    if (RESERVED.has(name)) return 'reserved';
    if (TAKEN.has(name)) return 'taken';
    return null;
  }

  async function publish(state, d) {
    await rm(siteDir(d.name), { recursive: true, force: true });
    await mkdir(siteDir(d.name), { recursive: true });
    await cp(join(dir, 'staging', d.deploy_id), siteDir(d.name), { recursive: true });
    const now = Date.now();
    const expires_at = new Date(now + YEAR_MS).toISOString();
    Object.assign(d, { state: 'published', url: siteUrl(d.name), expires_at });
    state.sites[d.name] = { name: d.name, url: d.url, state: 'live', expires_at, updated_at: new Date(now).toISOString() };
  }

  return {
    mock: true,
    async startLogin() {
      const state = await load();
      const code = `MOCK-${String(++state.seq).padStart(4, '0')}`;
      state.logins[code] = { created: Date.now() };
      await save(state);
      return { code, url: `https://app.nodcut.com/cli?code=${code}`, interval: 1, expires_in: 600 };
    },
    async pollLogin(code) {
      const state = await load();
      if (!state.logins[code]) return { status: 'expired' };
      delete state.logins[code];
      await save(state);
      return {
        status: 'approved',
        token: 'mock-token',
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        user: { id: 1, name: 'Mock User' },
      };
    },
    async checkName(name) {
      auth();
      const reason = nameProblem(await load(), name);
      return reason ? { name, available: false, reason } : { name, available: true };
    },
    async createDeploy(name, files) {
      auth();
      const state = await load();
      const reason = nameProblem(state, name);
      if (reason === 'invalid') throw new ApiError(400, 'invalid_name', `"${name}" is not a valid name.`);
      if (reason) throw new ApiError(409, 'name_taken', `${name}.nodcut.com is ${reason}.`);
      if (!files.some((f) => f.path === 'index.html')) throw new ApiError(400, 'no_index', 'No index.html at the top of the site.');
      const deploy_id = `dep_mock${String(++state.seq).padStart(4, '0')}`;
      state.deploys[deploy_id] = { deploy_id, name, state: 'uploading', files: files.map((f) => f.path) };
      await save(state);
      return {
        deploy_id,
        uploads: files.map((f) => ({ path: f.path, url: `mock://staging/${deploy_id}/${f.path}`, headers: {} })),
      };
    },
    async upload(upload, abs) {
      const rel = upload.url.replace('mock://staging/', '');
      const target = join(dir, 'staging', ...rel.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await copyFile(abs, target);
    },
    async uploaded(id) {
      auth();
      const state = await load();
      const d = state.deploys[id];
      if (!d) throw new ApiError(404, 'not_found', `No deploy ${id}.`);
      const missing = [];
      for (const path of d.files) {
        try {
          await stat(join(dir, 'staging', id, ...path.split('/')));
        } catch {
          missing.push(path);
        }
      }
      if (missing.length) throw new ApiError(400, 'missing_files', `${missing.length} files were not uploaded.`, { files: missing });
      Object.assign(d, { state: 'awaiting_payment', order_id: `${state.seq}`, paid_at: Date.now() + payMs });
      await save(state);
      return { pay_url: `https://test.paycom.uz/mock-order-${id}`, amount_uzs: PRICE_UZS, order_id: d.order_id };
    },
    async getDeploy(id) {
      auth();
      const state = await load();
      const d = state.deploys[id];
      if (!d) throw new ApiError(404, 'not_found', `No deploy ${id}.`);
      if (d.state === 'awaiting_payment' && Date.now() >= d.paid_at) d.state = 'paid';
      if (d.state === 'paid') await publish(state, d);
      await save(state);
      const { files, paid_at, order_id, ...out } = d;
      return out;
    },
    async listSites() {
      auth();
      return { sites: Object.values((await load()).sites) };
    },
  };
}
