// The sites API over HTTP (contract: API.md at the repo root), plus what the CLI and the
// mock share: errors, the name rule, and walking a site folder.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export class ApiError extends Error {
  constructor(status, code, message, body = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** No saved session, or the server said 401. */
export class NotLoggedIn extends Error {
  constructor(expired = false) {
    super(expired ? 'Your NodCut sign-in has expired.' : 'Not signed in to NodCut.');
    this.expired = expired;
  }
}

// 3–40 characters, a-z 0-9 and '-', no leading, trailing or double '-'.
const NAME = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const validName = (name) => typeof name === 'string' && NAME.test(name) && !name.includes('--');

// Never uploaded: dotfiles (.env, .git, .DS_Store) except .well-known, and dependency folders.
const SKIP_DIRS = new Set(['node_modules']);
const skipped = (name) => (name.startsWith('.') && name !== '.well-known') || SKIP_DIRS.has(name);

/**
 * Every file under `root`, as { path, abs, size } with '/' separators, sorted by path.
 * Symlinks are left out (and listed in `links`), so nothing outside the folder is uploaded.
 */
export async function collectFiles(root) {
  const files = [];
  const links = [];
  async function walk(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (skipped(entry.name)) continue;
      const abs = join(dir, entry.name);
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) links.push(path);
      else if (entry.isDirectory()) await walk(abs, path);
      else if (entry.isFile()) files.push({ path, abs, size: (await stat(abs)).size });
    }
  }
  await walk(root, '');
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { files, links };
}

export function httpApi(baseUrl, token) {
  async function call(method, path, body, { auth = true, ok = [] } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth) {
      if (!token) throw new NotLoggedIn();
      headers.authorization = `Bearer ${token}`;
    }
    let res;
    try {
      res = await fetch(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError(0, 'network', `Could not reach ${baseUrl}: ${e.cause?.code || e.message}`);
    }
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    // A session the shared authorizer refuses comes back as API Gateway's own 403 {"message":"Forbidden"}.
    if (auth && (res.status === 401 || (res.status === 403 && !data.error))) throw new NotLoggedIn(true);
    if (!res.ok && !ok.includes(res.status)) {
      throw new ApiError(res.status, data.error || `http_${res.status}`, data.message || text.slice(0, 200), data);
    }
    return { status: res.status, data };
  }

  return {
    async startLogin() {
      return (await call('POST', '/cli-login', {}, { auth: false })).data;
    },
    /** → { status: 'pending' } | { status: 'approved', token, expires_at, user } | { status: 'expired' | 'denied' } */
    async pollLogin(code) {
      const { status, data } = await call('GET', `/cli-login/${encodeURIComponent(code)}`, undefined, {
        auth: false,
        ok: [202, 403, 410],
      });
      if (status === 202) return { status: 'pending' };
      if (status === 410) return { status: 'expired' };
      if (status === 403) return { status: 'denied' };
      return { status: 'approved', ...data };
    },
    async checkName(name) {
      return (await call('GET', `/names/${encodeURIComponent(name)}`)).data;
    },
    async createDeploy(name, files) {
      return (await call('POST', '/deploys', { name, files: files.map(({ path, size }) => ({ path, size })) })).data;
    },
    async upload(upload, abs) {
      const body = await readFile(abs);
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await fetch(upload.url, { method: 'PUT', headers: upload.headers || {}, body });
          if (res.ok) return;
          if (res.status < 500 || attempt >= 3) {
            throw new ApiError(res.status, 'upload_failed', `Upload of ${upload.path} failed: HTTP ${res.status}`);
          }
        } catch (e) {
          if (e instanceof ApiError || attempt >= 3) {
            throw e instanceof ApiError ? e : new ApiError(0, 'upload_failed', `Upload of ${upload.path} failed: ${e.message}`);
          }
        }
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    },
    async uploaded(id) {
      return (await call('POST', `/deploys/${encodeURIComponent(id)}/uploaded`, {})).data;
    },
    async getDeploy(id) {
      return (await call('GET', `/deploys/${encodeURIComponent(id)}`)).data;
    },
    async listSites() {
      return (await call('GET', '/sites')).data;
    },
  };
}
