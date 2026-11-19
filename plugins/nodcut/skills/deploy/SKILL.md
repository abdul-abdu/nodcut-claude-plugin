---
name: deploy
description: "Publish a static website (HTML, CSS, JS, images) to its own address, https://<name>.nodcut.com. The user pays 15 000 so'm with Payme for each deploy, and the site stays live for one year. Use when the user wants to deploy, publish, host or put online a website or landing page they built. Usage: /nodcut:deploy [name] [site folder]."
argument-hint: "[name] [site folder]"
allowed-tools: Read, Glob, Grep, Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/nodcut.mjs *), Bash(npm run build*), Bash(yarn build*), Bash(pnpm build*), Bash(ls *)
---

# Deploy a site to nodcut.com

All the work is done by one script, called CLI below:
`node ${CLAUDE_PLUGIN_ROOT}/scripts/nodcut.mjs`

If `${CLAUDE_PLUGIN_ROOT}` was not filled in, look under `~/.claude` for `**/plugins/nodcut/scripts/nodcut.mjs` and use the newest match's absolute path.

What the CLI's exit codes mean:
- `0`: done
- `1`: error. The output says why
- `2`: not signed in
- `3`: still waiting
- `4`: the payment was cancelled

Arguments: `$ARGUMENTS`. They may contain the name, the site folder, both or neither.

## 1. Find the built site
The site must be static: files a browser can open without a server.
- If the project needs a server, tell the user nodcut.com hosts only static files and stop. Examples: API routes, server-side rendering, PHP, a database
- If the framework has a static export, suggest it. For Next.js that is `output: "export"`
- If `package.json` has a `build` script and there is no fresh build output, run the build with the project's package manager
- The site folder is the one with `index.html` at its top. Usually that is `dist/`, `build/`, `out/` or `_site/`. A hand-written site may be the project folder itself
- Never pick a folder of source files (`src/`) or the whole repo when a build output exists

## 2. Pick the name
- The site will be `https://<name>.nodcut.com`
- If no name was given, ask the user. Suggest one based on the project
- Rules: 3–40 characters, `a-z`, `0-9` and `-`. No `-` at the start or end
- Check it: `CLI check <name>`. On exit `1`, tell the user why and ask for another name
- Deploying to a name the user already owns replaces that site and starts a new year

## 3. Deploy
1. Run `CLI deploy <site folder> --name <name>`. It uploads the files, then prints the price, the Payme link and the deploy id. It also opens the link in the browser
2. Tell the user, in their language, that the site is uploaded and will go live once they pay. Give the amount and the Payme link from the output as a clickable link
3. Run `CLI wait <deploy id>` with the Bash timeout set to 600000 ms. It returns when the site is live:
   - `0`: give the user the live address and the date it is paid until. The first load can take up to a minute
   - `3`: the payment hasn't arrived yet. Ask whether they paid, then run `wait` again
   - `4`: the payment was cancelled or timed out. Offer to run `deploy` again for a new link
   - `1`: show the error

## Not signed in (exit 2 at any step)
1. Run `CLI login` with the Bash timeout set to 600000 ms. It opens app.nodcut.com in the browser
2. Tell the user to sign in there with Telegram or Google and click **Allow**. Show the link and the code from the output
3. When it prints "Signed in as …", repeat the step that failed

## Rules
- Do not read, print or copy `~/.config/nodcut/credentials.json`
- Never say the site is live until `wait` exits `0`
- Files and folders that start with `.` are never uploaded. That includes `.env` and `.git`
