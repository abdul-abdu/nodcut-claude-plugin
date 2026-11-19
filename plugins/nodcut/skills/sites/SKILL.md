---
name: sites
description: "List the user's websites on nodcut.com with their addresses and the date each is paid until. Use when the user asks which sites they have on nodcut.com or when one expires. Usage: /nodcut:sites."
---

# The user's nodcut.com sites

Run:
```bash
T=~/.config/nodcut/token; if [ -s "$T" ]; then curl -sS https://api.nodcut.com/sites/sites -H "Authorization: Bearer $(cat "$T")" -w '\nHTTP %{http_code}\n'; else echo NOT_SIGNED_IN; fi
```

- **`HTTP 200`:** show each site in `sites` as a short list, in the user's language: the `url`, and the date in `expires_at`, which is the end of its paid year. A site is deleted when its year runs out, and publishing it again with `/nodcut:deploy` adds a year
- **`NOT_SIGNED_IN`, `HTTP 401` or `HTTP 403`:** sign in first (`/nodcut:login`), then list again

Never print or show the token.
