# NodCut for Claude Code

Publish the website you just built with Claude to its own address, **`https://<name>.nodcut.com`**, in one step. Ask Claude to "deploy this site", or run `/nodcut:deploy`. Claude finds or builds the site, uploads it and shows a Payme link. Once you pay, the site is live.

- **Price:** 15 000 so'm per deploy, paid with Payme. The site stays live for one year.
- **Updates:** deploying the same name again replaces the site and adds a year.
- **Account:** your NodCut account. Sign in with Telegram or Google at [app.nodcut.com](https://app.nodcut.com).
- **Sites:** static only (HTML, CSS, JavaScript, images, fonts). Nothing runs on a server.

## Install
In Claude Code:
```
/plugin marketplace add abdul-abdu/nodcut-claude-plugin
/plugin install nodcut@nodcut
```
Nothing else to install. Claude uses `curl` and `tar`, which macOS, Linux and Windows 10+ already have, and asks before running them.

## Use
- **`/nodcut:deploy [name] [folder]`:** deploys your site. If you leave out the name or folder, Claude asks for the name and finds the built site folder itself
- **`/nodcut:login`:** signs in. A browser page opens; check the code and click **Allow**. Run `/nodcut:login status` to see who is signed in, or `/nodcut:login logout` to sign out
- **`/nodcut:sites`:** lists your sites and the date each is paid until

The first deploy signs you in automatically.

## What gets uploaded
Only the site folder Claude picks, usually `dist/`, `build/` or `out/`. Files and folders starting with `.` are never uploaded, so `.env` and `.git` stay on your computer, and neither does `node_modules`. Your sign-in is saved in `~/.config/nodcut/token`, readable only by you. The full list of what is sent where is in [the plugin's README](plugins/nodcut/README.md#what-the-plugin-runs-sends-and-stores).

## Development
The plugin is Markdown only: the skills in `plugins/nodcut/skills/` tell Claude which `curl` and `tar` commands to run. Try it locally with `claude --plugin-dir plugins/nodcut`. `API.md` is the contract with the NodCut API at `https://api.nodcut.com/sites`.

## Support
Questions or a problem with a site: [@NodCutBot](https://t.me/NodCutBot) on Telegram.

## License
MIT
