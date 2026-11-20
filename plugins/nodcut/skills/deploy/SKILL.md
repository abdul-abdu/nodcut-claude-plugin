---
name: deploy
description: "Publish a static website (HTML, CSS, JS, images) the user built to its own address, https://<name>.nodcut.com. A new site costs 15 000 so'm with Payme and stays live for one year; updating a live site the user owns costs 4 NodCut credits and keeps its end date. Use when the user wants to deploy, publish, host or put online a website or landing page. Usage: /nodcut:deploy [name] [site folder]."
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
   3. If the answer has a `pay_url`, give it to the user exactly as returned, with the amount it shows (15 000 so'm for a new site or a renewal, 12 500 so'm for 50 credits when an update finds the balance short). An update paid from the balance has no `pay_url`: tell the user how many credits were taken and how many are left
   4. Call `get_publish_status` with `wait_seconds: 20`, again and again, until it says `published`. Then give the address and the end of the paid year
   5. If a tool says the user isn't connected, tell them to connect NodCut: click Connect, then Allow on the NodCut page that opens
   6. If the site is over 4 MB, or has photos you can't send as base64, use the second way instead, when you can run commands
2. **Commands, in Claude Code only.** Use them when the connector isn't available or the site is too big for it. Sections 3–5 below run with the Bash tool, using `curl` and `tar`, which macOS, Linux and Windows 10+ all have. Set the Bash timeout to 600000 ms on the commands that wait.

## 1. Find the site
In chat, the site is the files you just wrote (HTML, CSS, JS) for the user.
In Claude Code or Cowork, it is a folder. The site must be static: files a browser opens without a server.
- **Needs a server** (API routes, server-side rendering, PHP, a database): say nodcut.com hosts only static sites, and stop. If the framework has a static export, offer it (Next.js: `output: "export"`)
- **Only needs forms or saved data** (RSVPs, orders, contact forms, guest books, likes, votes): that works on a static site. Follow the `forms` skill, and publish its `nodcut.json` with the other files
- **Has a build step:** if `package.json` has a `build` script and there is no fresh build output, run the build with the project's package manager
- **The site folder** is the folder with `index.html` at its top: usually `dist/`, `build/`, `out/` or `_site/`, or the project folder itself for a hand-written site
- **Never the source:** never pick `src/`, or the whole repo, when a build output exists

Use the folder's absolute path below as SITE.

## Before publishing: the safety check
Check the site, fix what you find yourself, and tell the user in one short line what you fixed:
1. **No secrets:** every file of a site is public. No API keys, bot tokens, passwords or private keys in HTML or JavaScript
2. **No payment or login details:** no fields for card numbers, CVV, SMS codes, or passwords of other services. Payments go through the owner's own Payme or Click page. NodCut refuses such sites
3. **Visitor text** (form entries, URL parameters) goes on the page with `textContent`, never `innerHTML`
4. **Scripts:** only from well-known CDNs (cdnjs, jsdelivr, unpkg) with a pinned version, and no `eval`
5. **Links:** links to other sites use `https://` and `target="_blank" rel="noopener"`
6. **No private data in the files:** no customer lists, phone numbers or ID documents
7. **Forms** follow the `forms` skill: honeypot, `_next`, and private fields never public
8. **Content-Security-Policy:** add this `<meta>` to every page's `<head>`, and widen it only for what the site really uses:
   ```html
   <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https://api.nodcut.com; frame-src https://www.youtube.com https://www.google.com; form-action 'self' https://api.nodcut.com">
   ```

If publishing answers `unsafe_content`, read its message, fix the file it names, and publish again.

## 2. Pick the name
- The address will be `https://<name>.nodcut.com`
- If no name was given, suggest one from the project and ask the user to confirm it
- **Rules:** 3–40 characters, lowercase `a-z`, `0-9` and `-`, with no `-` at the start or end. Names that look like a bank, a payment service or NodCut (`payme`, `click`, `bank`, `login`…) are refused
- **Updating:** deploying again to a live site the user owns is an update. It replaces the files, keeps the end date, and costs 4 NodCut credits from their balance with no payment page. When the balance has fewer than 4, the answer has a Payme link for 50 credits (12 500 so'm); the update goes out once that is paid, and the other 46 credits stay on the balance
- **Renewing:** only when the user asks for another year, add `"renew":true` to the deploy (section 3). It costs 15 000 so'm and adds a year from the current end date

## 3. Deploy
Tell the user the price first: 15 000 so'm with Payme for a new site or a renewal (a year), or 4 NodCut credits for an update of their live site. Then run this one command with SITE, NAME and LANG filled in. For a renewal, change `"archive":true` to `"archive":true,"renew":true`. LANG is `uz`, `ru` or `en`, matching the user's language, for the Payme page:

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
- **Ends with `pay_url` and `HTTP 200`:** the files are uploaded, and the Payme page has opened in the browser. Tell the user to pay the `amount_uzs` shown there (15 000 so'm for a year, or 12 500 so'm for 50 credits when an update found the balance short). Also give them the `pay_url` link from the output, copied exactly, in case the page didn't open. Keep the `DEPLOY_ID`
- **`"state":"paid"` and `HTTP 200`, no `pay_url`:** an update, paid from the balance. Tell the user `cost_credits` credits were taken and `balance` are left, then go to section 4 with the `DEPLOY_ID`

## 4. Wait until it's live
Run this with DEPLOY_ID filled in and the Bash timeout at 600000 ms. It waits up to about 9 minutes:

```bash
T=~/.config/nodcut/token; for i in $(seq 1 270); do r=$(curl -sS "https://api.nodcut.com/sites/deploys/DEPLOY_ID" -H "Authorization: Bearer $(cat "$T")"); case "$r" in *'"state":"awaiting_payment"'*|*'"state":"paid"'*|*'"state":"publishing"'*|*'"state":"uploading"'*) sleep 2;; *) break;; esac; done; echo "$r"
```

What the `state` means:
- **`published`:** give the user the `url` (`https://<name>.nodcut.com`) and the date in `expires_at`, the end of the paid year (unchanged by an update). The first visit can take a minute
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
