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
- Works in Claude Code. Claude runs `curl` and `tar` (built into macOS, Linux and Windows 10+) and asks your permission first. Nothing gets installed
- The service is run by NodCut (nodcut.com), not by Anthropic

## What the plugin runs, sends and stores
The plugin is only instructions for Claude (`skills/*/SKILL.md`). The commands Claude runs are written out in those files.

**Sent to NodCut's API, `https://api.nodcut.com/sites`:**
- **Sign-in:** a request for a one-time sign-in code, then a check every 2 seconds until you approve it
- **Every call after sign-in:** your NodCut session token
- **Deploying:** the site name you choose and the site folder as one `.tar.gz` archive. The archive goes to Amazon S3 (`*.s3.eu-central-1.amazonaws.com`) through a one-time upload link the API returns
- **Your sites:** checks on the deploy's status, and the list of your sites

**Never uploaded:** files and folders whose names start with `.` (such as `.env` and `.git`) and `node_modules`. The archive is built in your system's temporary folder.

**Opened in your browser** (the links are also shown):
- **Sign-in:** `https://app.nodcut.com/cli?code=…`, where you sign in with Telegram or Google and click Allow
- **Payment:** the Payme checkout page (`https://checkout.paycom.uz/…`) for 15 000 so'm. You pay there yourself, and the plugin never sees card details

**Stored on your computer:** your NodCut session token in `~/.config/nodcut/token`, readable only by you. Run `/nodcut:login logout` to delete it.

**Kept by NodCut:**
- **Published sites:** your files, public at `https://<name>.nodcut.com` for the paid year, then deleted
- **Archives that were never paid for:** deleted after 1 day
- **Deploy records:** kept for 90 days
- **Sign-in codes:** expire after 10 minutes

Sites that break NodCut's terms (for example phishing) are taken down.

Support: [@NodCutBot](https://t.me/NodCutBot) on Telegram.
