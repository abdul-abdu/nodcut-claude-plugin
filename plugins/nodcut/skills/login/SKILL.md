---
name: login
description: "Sign in to NodCut (Telegram or Google) so Claude can publish sites to nodcut.com, or check or end that sign-in. Usage: /nodcut:login [status | logout]."
argument-hint: "[status | logout]"
disable-model-invocation: true
---

# NodCut sign-in

Speak the user's language and keep it short.

Arguments: `$ARGUMENTS`

## `status`
Run:
```bash
T=~/.config/nodcut/token; if [ -s "$T" ]; then curl -sS -o /dev/null -w 'HTTP %{http_code}\n' https://api.nodcut.com/sites/sites -H "Authorization: Bearer $(cat "$T")"; else echo NOT_SIGNED_IN; fi
```
- **`HTTP 200`:** signed in
- **Anything else:** not signed in, or the sign-in expired

## `logout`
Run `rm -f ~/.config/nodcut/token`, then tell the user they're signed out.

## Otherwise: sign in
Follow section 5, "Signing in", of the `deploy` skill (`/nodcut:deploy`):
1. Run `curl -sS -X POST https://api.nodcut.com/sites/cli-login`. It returns `code` and `url`
2. Tell the user to open the `url` (on macOS, also run `open "<url>"` for them), sign in with Telegram or Google, check that the page shows the same `code`, and click **Allow**
3. Run the waiting command from that section, with CODE filled in and the Bash timeout at 600000 ms. It saves the sign-in to `~/.config/nodcut/token` for 30 days

On `SIGNED_IN`, tell the user they can now publish with `/nodcut:deploy`, or just by saying "publish my site".

Never print or show the token.
