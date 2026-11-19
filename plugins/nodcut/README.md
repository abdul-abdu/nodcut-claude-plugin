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
- Files and folders starting with `.` (such as `.env` and `.git`) and `node_modules` are never uploaded
- Your sign-in is saved in `~/.config/nodcut/credentials.json`, readable only by you
- Needs Node.js 18 or later

## Development
- `NODCUT_API=mock` runs everything offline. Sign-in approves itself, payment arrives after 3 seconds, and the site is written to `~/.config/nodcut/mock/sites/<name>/`
- `NODCUT_API_URL` points the plugin at another server
- Tests: `npm test` from the repository root
