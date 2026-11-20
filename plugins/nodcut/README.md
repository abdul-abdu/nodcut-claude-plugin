# nodcut: publish a website from Claude Code

Build a website with Claude, then publish it to its own address, `https://<name>.nodcut.com`.
A new site costs 15 000 so'm, paid with Payme, and stays live for one year.
Updating it later costs 4 NodCut credits (about 1 000 so'm) and keeps its end date; another year is 15 000 so'm.

## Install
```
/plugin marketplace add abdul-abdu/nodcut-claude-plugin
/plugin install nodcut@nodcut
```

## Use
- **`/nodcut:deploy [name] [folder]`:** builds the site if needed, uploads it, shows the Payme link, then waits until the site is live. You can also just say "deploy this site"
- **`/nodcut:login`:** signs in with your NodCut account (Telegram or Google) in the browser. `/nodcut:login status` shows who is signed in, and `/nodcut:login logout` signs out
- **`/nodcut:sites`:** lists your sites and the date each is paid until
- **`/nodcut:forms [what for]`:** adds a form or saved data to a site: RSVPs, orders, contact forms, guest books, likes, votes. Each entry reaches you on Telegram and in the NodCut app

## Good to know
- Only static sites are supported: HTML, CSS, JS and images. Nothing runs on a server. Forms and saved data still work, through NodCut's forms API (see the `forms` skill)
- **Works everywhere through the NodCut connector:** Claude chat (web, desktop, mobile), Cowork and Claude Code. The first time, Claude asks you to connect NodCut. A NodCut page opens, where you sign in with Telegram or Google and click Allow
- **Big sites from Claude Code:** sites over 4 MB, or with many photos, can also be published from Claude Code without the connector. Claude runs `curl` and `tar` (built into macOS, Linux and Windows 10+) and asks your permission first
- The service is run by NodCut (nodcut.com), not by Anthropic

## What the plugin runs, sends and stores
The plugin is instructions for Claude (`skills/*/SKILL.md`) plus one remote connector, NodCut's MCP server at `https://mcp.nodcut.com/mcp` (declared in `plugin.json`). The plugin contains no code. Any commands Claude runs are written out in the skill files.

**Through the connector (`https://mcp.nodcut.com`):**
- **Connecting:** standard OAuth. You sign in on `app.nodcut.com` and click Allow. Claude then holds your NodCut session (valid 30 days) to call the connector's tools
- **Tools:**
  - `check_site_name`: sends a name
  - `publish_site`: sends the site's files, the name and your language, and returns the Payme link (or, for an update paid from your credits, none)
  - `get_publish_status`: sends a deploy id
  - `list_my_sites`: sends nothing
- **Never sent:** the connector never sees your other chats, files or photos, only what Claude passes to these tools

**Through commands, in Claude Code only:**

**Sent to NodCut's API, `https://api.nodcut.com/sites`:**
- **Sign-in:** a request for a one-time sign-in code, then a check every 2 seconds until you approve it
- **Every call after sign-in:** your NodCut session token
- **Deploying:** the site name you choose and the site folder as one `.tar.gz` archive. The archive goes to Amazon S3 (`*.s3.eu-central-1.amazonaws.com`) through a one-time upload link the API returns
- **Your sites:** checks on the deploy's status, and the list of your sites

**Never uploaded:** files and folders whose names start with `.` (such as `.env` and `.git`) and `node_modules`. The archive is built in your system's temporary folder.

**Opened in your browser** (the links are also shown):
- **Sign-in:** `https://app.nodcut.com/cli?code=…`, where you sign in with Telegram or Google and click Allow
- **Payment:** the Payme checkout page (`https://checkout.paycom.uz/…`): 15 000 so'm for a site's year, or 12 500 so'm for 50 credits when an update finds your balance short. You pay there yourself, and the plugin never sees card details

**Stored on your computer:** your NodCut session token in `~/.config/nodcut/token`, readable only by you. Run `/nodcut:login logout` to delete it.

**Kept by NodCut:**
- **Published sites:** your files, public at `https://<name>.nodcut.com` for the paid year, then deleted
- **Archives that were never paid for:** deleted after 1 day
- **Deploy records:** kept for 90 days
- **Sign-in codes:** expire after 10 minutes

Sites that break NodCut's terms (for example phishing) are taken down.

Support: [@NodCutBot](https://t.me/NodCutBot) on Telegram.
