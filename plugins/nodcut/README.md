# nodcut: publish a website from Claude Code

Build a website with Claude, then publish it to its own address, `https://<name>.nodcut.com`.
Each deploy costs 15 000 so'm, paid with Payme, and the site stays live for one year.
Deploying the same name again replaces the site and starts a new year.

## Install
```
/plugin marketplace add abdul-abdu/nodcut-claude-plugin
/plugin install nodcut@nodcut
```

## Use
- **`/nodcut:deploy [name] [folder]`:** builds the site if needed, uploads it, shows the Payme link, then waits until the site is live. You can also just say "deploy this site"
- **`/nodcut:login`:** signs in with your NodCut account (Telegram or Google) in the browser. `/nodcut:login status` shows who is signed in, and `/nodcut:login logout` signs out
- **`/nodcut:sites`:** lists your sites and the date each is paid until

## Good to know
- Only static sites are supported: HTML, CSS, JS and images. Nothing runs on a server
- Needs Claude Code and Node.js 18 or later. It does not work in Claude chat on the web
- The service is run by NodCut (nodcut.com), not by Anthropic

## What the plugin runs, sends and stores
Everything goes through one readable script, `scripts/nodcut.mjs`, which uses only Node's built-in modules. Claude runs it with `node`. It installs nothing.

**Sent to NodCut's API, `https://api.nodcut.com/sites`:**
- **Sign-in:** a request for a one-time sign-in code, then polling until you approve it
- **Every call after sign-in:** your NodCut session token
- **Deploying:** the site's name, plus the path and size of each file in the site folder you choose
- **Your sites:** requests for deploy status and your list of sites

**Uploaded to Amazon S3:** each file in the site folder, through one-time upload links the API returns (`*.s3.eu-central-1.amazonaws.com`). Never uploaded: files and folders whose names start with `.` (such as `.env` and `.git`), `node_modules`, and symlinks.

**Opened in your browser** (with `open`, `xdg-open` or `rundll32`; the links are also printed):
- **Sign-in:** `https://app.nodcut.com/cli?code=…`, where you sign in with Telegram or Google and click Allow
- **Payment:** the Payme checkout page (`https://checkout.paycom.uz/…`) for 15 000 so'm. You pay there yourself, and the plugin never sees card details

**Stored on your computer:** your NodCut session token, name and account id in `~/.config/nodcut/credentials.json` (mode 600). Delete it, or run `/nodcut:login logout`, to sign out.

**Kept by NodCut:**
- **Published sites:** your files, public at `https://<name>.nodcut.com` for the paid year, then deleted
- **Uploads that were never paid:** deleted after 1 day
- **Deploy records:** kept for 90 days
- **Sign-in codes:** expire after 10 minutes

Sites that break NodCut's terms (for example phishing) are taken down.

Support: [@NodCutBot](https://t.me/NodCutBot) on Telegram.

## Development
- `NODCUT_API=mock` runs everything offline. Sign-in approves itself, payment arrives after 3 seconds, and the site is written to `~/.config/nodcut/mock/sites/<name>/`
- `NODCUT_API_URL` points the plugin at another server
- Tests: `npm test` from the repository root
