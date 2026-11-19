# Sites API contract

The plugin (`plugins/nodcut/scripts/nodcut.mjs`) and the sites stack (`nodcut/backend/sites/`) both follow this file.
Base URL: `https://api.nodcut.com/sites`. Can be changed with `NODCUT_API_URL`.

- **Auth:** `Authorization: Bearer <session token>`. This is the same 30-day session the web app uses, checked by the shared stack's authorizer
- **Errors:** `{ "error": "<code>", "message": "<detail>" }`, the same shape as the rest of NodCut
- **Times:** ISO 8601 strings

## Login (device-code flow, no auth)

### `POST /cli-login`
→ `200 { code, url, interval, expires_in }`
- `code`: `ABCD-1234`, valid for 10 minutes
- `url`: `https://app.nodcut.com/cli?code=ABCD-1234`
- `interval`: seconds between polls

### `GET /cli-login/{code}`
- `202 { status: "pending" }`
- `200 { token, expires_at, user: { id, name } }`: returned only once, then the code is deleted
- `410 { error: "expired" }`
- `403 { error: "denied" }`: the user clicked Deny

### `POST /cli-login/{code}/approve` (auth: the app's session) and `POST /cli-login/{code}/deny`
Called by the `/cli` page in the app → `204`.
Allowing hands the CLI the approving browser's own 30-day session token (`Bearer` only: the Mini App's `tma` credential is refused). It is delivered once, on the next poll, then deleted.

## Names

### `GET /names/{name}` (auth)
→ `200 { name, available, reason? }`
- `reason`: `invalid` | `reserved` | `taken` | `blocked`
- `available` is `true` when the name is free, or when it already belongs to this user (an update)
- Name rule: `^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$`, 3–40 characters, no `--`

## Deploys

### `POST /deploys` (auth)
`{ name, files: [{ path, size }] }`
- `path`: relative, with `/` separators, no `..`
→ `201 { deploy_id, uploads: [{ path, url, headers }] }`
- `url`: a presigned `PUT` to the staging bucket. The client sends exactly the `headers` given, which include `Content-Type`

Errors:
- `400 invalid_name | invalid_files | no_index`
- `409 name_taken`
- `413 too_large`
- `401 unauthorized`

### `POST /deploys/{id}/uploaded` (auth), body `{ lang? }` (`uz` by default, for the Payme page)
The server checks that every file is in staging, then opens a Payme order (`kind: "site"`).
→ `200 { pay_url, amount_uzs, order_id }`
- `400 missing_files { message, files: [...] }`

### `GET /deploys/{id}` (auth)
→ `200 { deploy_id, name, state, url?, expires_at?, error? }`

`state`:
- `uploading`
- `awaiting_payment`
- `paid`
- `published`: `url` and `expires_at` are set
- `failed`: `error` is set
- `cancelled`: the payment was cancelled or timed out

Publishing runs when the order is paid. `GET` also starts it if it hasn't run yet, so it is safe to poll.

## Sites

### `GET /sites` (auth)
→ `200 { sites: [{ name, url, state, expires_at, updated_at }] }`
