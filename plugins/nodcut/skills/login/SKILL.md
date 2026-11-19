---
name: login
description: "Sign in to NodCut (Telegram or Google) so this computer can deploy sites to nodcut.com, or check or end that sign-in. Usage: /nodcut:login [status | logout]."
argument-hint: "[status | logout]"
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/nodcut.mjs *)
---

# NodCut sign-in

CLI: `node ${CLAUDE_PLUGIN_ROOT}/scripts/nodcut.mjs`. If `${CLAUDE_PLUGIN_ROOT}` was not filled in, look under `~/.claude` for `**/plugins/nodcut/scripts/nodcut.mjs`.

Arguments: `$ARGUMENTS`

- **`status`:** run `CLI whoami` and report the result
- **`logout`:** run `CLI logout` and report the result
- **Otherwise:**
  1. Run `CLI login` with the Bash timeout set to 600000 ms. It opens app.nodcut.com in the browser
  2. Tell the user to sign in with Telegram or Google and click **Allow**. Show the link and the code from the output
  3. When it prints "Signed in as …", tell the user they can now deploy with `/nodcut:deploy`
  4. On exit `3` the browser step wasn't finished in time. Offer to run it again

Never read or print `~/.config/nodcut/credentials.json`.
