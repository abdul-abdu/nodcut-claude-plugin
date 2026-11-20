# NodCut for Claude Code

Publish the website you just built with Claude to its own address, **`https://<name>.nodcut.com`**, in one step. Ask Claude to "deploy this site", or run `/nodcut:deploy`. Claude finds or builds the site, uploads it and shows a Payme link. Once you pay, the site is live.

- **Price:** 15 000 so'm for a new site, paid with Payme, or 60 NodCut credits if your balance has them. The site stays live for one year.
- **Updates:** deploying again to your live site replaces it for 4 NodCut credits (about 1 000 so'm) and keeps its end date. With too few credits, Claude gives a Payme link for 50 credits (12 500 so'm) first.
- **Another year:** ask Claude to renew; 15 000 so'm (or 60 credits) adds a year.
- **Credits first:** whenever your balance covers the price, Claude asks you, then takes the credits with no payment page.
- **Account:** your NodCut account. Sign in with Telegram or Google at [app.nodcut.com](https://app.nodcut.com).
- **Sites:** static only (HTML, CSS, JavaScript, images, fonts). Nothing runs on a server.

## Install
In Claude Code:
```
/plugin marketplace add abdul-abdu/nodcut-claude-plugin
/plugin install nodcut@nodcut
```
The first time you publish, Claude asks you to **connect NodCut**: a NodCut page opens, you sign in with Telegram or Google and click **Allow**. It works in Claude chat (web, desktop, mobile), Cowork and Claude Code.

## Use
- **`/nodcut:deploy [name] [folder]`:** deploys your site. If you leave out the name or folder, Claude asks for the name and finds the built site folder itself
- **`/nodcut:login`:** signs in. A browser page opens; check the code and click **Allow**. Run `/nodcut:login status` to see who is signed in, or `/nodcut:login logout` to sign out
- **`/nodcut:sites`:** lists your sites and the date each is paid until

The first deploy signs you in automatically.

## What gets uploaded
Only the site folder Claude picks, usually `dist/`, `build/` or `out/`. Files and folders starting with `.` are never uploaded, so `.env` and `.git` stay on your computer, and neither does `node_modules`. Your sign-in is saved in `~/.config/nodcut/token`, readable only by you. The full list of what is sent where is in [the plugin's README](plugins/nodcut/README.md#what-the-plugin-runs-sends-and-stores).

## Development
The plugin is Markdown skills (`plugins/nodcut/skills/`) plus NodCut's remote MCP connector (`https://mcp.nodcut.com/mcp`, OAuth through app.nodcut.com). In Claude Code, the skills can also publish with `curl` and `tar`. Try it locally with `claude --plugin-dir plugins/nodcut`. `API.md` is the contract with the NodCut API at `https://api.nodcut.com/sites`.

## Support
Questions or a problem with a site: [@NodCutBot](https://t.me/NodCutBot) on Telegram.

## License
MIT
