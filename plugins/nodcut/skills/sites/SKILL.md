---
name: sites
description: "List the user's sites on nodcut.com with their addresses and the date each is paid until. Use when the user asks which sites they have on nodcut.com or when one expires. Usage: /nodcut:sites."
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/nodcut.mjs *)
---

# The user's nodcut.com sites

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/nodcut.mjs sites`. If `${CLAUDE_PLUGIN_ROOT}` was not filled in, look under `~/.claude` for `**/plugins/nodcut/scripts/nodcut.mjs`
2. Show the result as a short list: the address and the date it is paid until
3. A site is deleted when its year runs out. Deploying it again with `/nodcut:deploy` starts a new year from that day
4. On exit `2`, the user isn't signed in:
   1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/nodcut.mjs login` with the Bash timeout set to 600000 ms
   2. Tell the user to sign in in the browser and click **Allow**
   3. Then list the sites again
