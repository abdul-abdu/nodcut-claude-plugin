---
name: deploy
description: "Publish a static website (HTML, CSS, JS, images) the user built to its own address, https://<name>.nodcut.com. The user pays 15 000 so'm with Payme for each deploy, and the site stays live for one year. Use when the user wants to deploy, publish, host or put online a website or landing page. Usage: /nodcut:deploy [name] [site folder]."
argument-hint: "[name] [site folder]"
---

# Deploy a site to nodcut.com

The user may not be technical:
- Speak their language
- Keep each message short: what is happening, and what they should do next
- Don't show them commands, JSON or HTTP codes unless something fails and the detail helps

Arguments: `$ARGUMENTS`. They may hold the name, the site folder, both or neither.

## Two ways to publish
1. **The NodCut connector (preferred).** Use it when its tools are available: `check_site_name`, `publish_site`, `get_publish_status`, `list_my_sites`. It works everywhere, in chat, Cowork and Claude Code:
   1. Pick the name (section 2), and check it with `check_site_name`
   2. Call `publish_site` with every file of the site: `index.html` at the top, plus CSS, JS, other pages and images. Use paths from the site root, text as `utf8` and binary files as `base64`. Pass the user's `language` (`uz`, `ru` or `en`)
   3. Give the user the `pay_url` exactly as returned, and tell them it costs 15 000 so'm, paid on Payme
   4. Call `get_publish_status` with `wait_seconds: 20`, again and again, until it says `published`. Then give the address and the end of the paid year
   5. If a tool says the user isn't connected, tell them to connect NodCut: click Connect, then Allow on the NodCut page that opens
   6. If the site is over 4 MB, or has photos you can't send as base64, use the second way instead, when you can run commands
2. **Commands, in Claude Code only.** Use them when the connector isn't available or the site is too big for it. Sections 3–5 below run with the Bash tool, using `curl` and `tar`, which macOS, Linux and Windows 10+ all have. Set the Bash timeout to 600000 ms on the commands that wait.

## 1. Find the site
In chat, the site is the files you just wrote (HTML, CSS, JS) for the user.
In Claude Code or Cowork, it is a folder. The site must be static: files a browser opens without a server.
- **Needs a server** (API routes, server-side rendering, PHP, a database): say nodcut.com hosts only static sites, and stop. If the framework has a static export, offer it (Next.js: `output: "export"`)
- **Has a build step:** if `package.json` has a `build` script and there is no fresh build output, run the build with the project's package manager
- **The site folder** is the folder with `index.html` at its top: usually `dist/`, `build/`, `out/` or `_site/`, or the project folder itself for a hand-written site
- **Never the source:** never pick `src/`, or the whole repo, when a build output exists

Use the folder's absolute path below as SITE.

## 2. Pick the name
- The address will be `https://<name>.nodcut.com`
- If no name was given, suggest one from the project and ask the user to confirm it
- **Rules:** 3–40 characters, lowercase `a-z`, `0-9` and `-`, with no `-` at the start or end
- Deploying again to a name the user already owns replaces that site and adds a year

## 3. Deploy
Tell the user it costs 15 000 so'm, paid with Payme, and keeps the site live for a year. Then run this one command with SITE, NAME and LANG filled in. LANG is `uz`, `ru` or `en`, matching the user's language, for the Payme page:

```bash
T=~/.config/nodcut/token; A=https://api.nodcut.com/sites; F="${TMPDIR:-/tmp}/nodcut-site.tar.gz"; SITE="SITE"
if [ ! -s "$T" ]; then echo NOT_SIGNED_IN; else
  COPYFILE_DISABLE=1 tar -czf "$F" -C "$(dirname "$SITE")" --exclude='*/.?*' --exclude=node_modules "$(basename "$SITE")" &&
  r=$(curl -sS -X POST "$A/deploys" -H "Authorization: Bearer $(cat "$T")" -H 'Content-Type: application/json' -d '{"name":"NAME","archive":true}' -w '\nHTTP %{http_code}') &&
  printf '%s\n' "$r" | sed 's/"url":"[^"]*"/"url":"(upload link)"/' &&
  id=$(printf '%s' "$r" | sed -n 's/.*"deploy_id":"\([^"]*\)".*/\1/p') && url=$(printf '%s' "$r" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p') &&
  if [ -n "$id" ] && [ -n "$url" ]; then
    curl -sS -f -X PUT -H 'Content-Type: application/gzip' --upload-file "$F" "$url" &&
    p=$(curl -sS -X POST "$A/deploys/$id/uploaded" -H "Authorization: Bearer $(cat "$T")" -H 'Content-Type: application/json' -d '{"lang":"LANG"}' -w '\nHTTP %{http_code}') &&
    printf 'DEPLOY_ID %s\n%s\n' "$id" "$p" &&
    pay=$(printf '%s' "$p" | sed -n 's/.*"pay_url":"\([^"]*\)".*/\1/p') &&
    if [ -n "$pay" ]; then (open "$pay" || xdg-open "$pay" || start "" "$pay") >/dev/null 2>&1; fi
  fi
fi
```

What the output means:
- **`NOT_SIGNED_IN`, or `HTTP 401` / `HTTP 403`:** sign in (section 5), then run the command again
- **`HTTP 409` with `name_taken`:** the name belongs to someone else or is reserved. Ask for another one
- **`HTTP 400` / `413`:** show the `message`. Common causes: no `index.html` at the top of SITE, or the site is over 100 MB
- **Ends with `pay_url` and `HTTP 200`:** the files are uploaded, and the Payme page has opened in the browser. Tell the user to pay 15 000 so'm there. Also give them the `pay_url` link from the output, copied exactly, in case the page didn't open. Keep the `DEPLOY_ID`

## 4. Wait until it's live
Run this with DEPLOY_ID filled in and the Bash timeout at 600000 ms. It waits up to about 9 minutes:

```bash
T=~/.config/nodcut/token; for i in $(seq 1 270); do r=$(curl -sS "https://api.nodcut.com/sites/deploys/DEPLOY_ID" -H "Authorization: Bearer $(cat "$T")"); case "$r" in *'"state":"awaiting_payment"'*|*'"state":"paid"'*|*'"state":"publishing"'*|*'"state":"uploading"'*) sleep 2;; *) break;; esac; done; echo "$r"
```

What the `state` means:
- **`published`:** give the user the `url` (`https://<name>.nodcut.com`) and the date in `expires_at`, the end of the paid year. The first visit can take a minute
- **Still `awaiting_payment`:** the payment hasn't arrived. Ask whether they paid, then run the wait again
- **`cancelled`:** the payment was cancelled or timed out. Offer to deploy again for a new link
- **`failed`:** show the `error`. Any credits taken were returned to their NodCut balance

## 5. Signing in
Only when needed:
1. Run `curl -sS -X POST https://api.nodcut.com/sites/cli-login`. It returns `code` and `url`
2. Tell the user to open the `url` (on macOS, also run `open "<url>"` for them), sign in with Telegram or Google, check that the page shows the same `code`, and click **Allow**
3. Then run this with CODE filled in and the Bash timeout at 600000 ms. It waits up to 5 minutes and saves the sign-in for 30 days:

```bash
mkdir -p ~/.config/nodcut && chmod 700 ~/.config/nodcut; res=STILL_WAITING
for i in $(seq 1 150); do
  r=$(curl -sS -w '\n%{http_code}' "https://api.nodcut.com/sites/cli-login/CODE"); s=$(printf '%s' "$r" | tail -n 1)
  if [ "$s" = 200 ]; then (umask 077; printf '%s' "$r" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' > ~/.config/nodcut/token); res=SIGNED_IN; break; fi
  if [ "$s" != 202 ]; then res="FAILED $s"; break; fi
  sleep 2
done; echo "$res"
```

What the result means:
- **`SIGNED_IN`:** go back to the step that needed the sign-in
- **`FAILED 403`:** the user clicked Deny
- **`FAILED 410`:** the code expired. Start again from step 1

## Rules
- Never print, show or copy the token in `~/.config/nodcut/token`, and never send it anywhere except `https://api.nodcut.com`
- Never say the site is live until the wait says `published`
- Files and folders whose names start with `.` (such as `.env` and `.git`), and `node_modules`, are never uploaded
