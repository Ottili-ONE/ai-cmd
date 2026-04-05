# `ai-cmd` Analytics Server

This document describes the server-side pieces needed for the opt-in analytics flow implemented in `ai-cmd` `v1.0.3`.

## Important Limitation

Because `ai-cmd` is a public open-source client, there is no way to embed a private secret that only the tool knows. A determined attacker can always mimic a public client.

What you can do is make abuse much harder:

- require a server-issued short-lived session
- sign that session on the server with your private secret
- require proof-of-work on every analytics request
- rate-limit by IP, session, and install id
- reject malformed payloads aggressively

That is what the current client implementation expects.

## Privacy Model

- Analytics are sent only when the user explicitly enables `"analytics": true` in `~/.ai-cmd/config.json`.
- A random `analyticsId` is generated locally and reused as the anonymous install identifier.
- Regular usage events do not include command content.
- Error reports may include the user prompt that triggered the failure. Keep that in the privacy notice and retention policy.
- There is intentionally no hidden pre-consent beacon.

## Base URL

Point DNS for `tracking.ottili.one` to your server and terminate HTTPS there.

Expose these endpoints under:

```text
https://tracking.ottili.one/api/aicmd
```

## Required Endpoints

### `POST /api/aicmd/session`

Creates a short-lived telemetry session.

Request:

```json
{
  "installId": "76f7075b-1d24-46d3-b037-78c4b6460a4b",
  "app": "ai-cmd",
  "version": "1.0.3"
}
```

Response:

```json
{
  "sessionId": "f7b1d4a8-0e6d-4c2d-a78c-5a1b277f0b5a",
  "nonce": "d7a4f8810b7f2a8f4f7f6f8d7a1c2b3e",
  "difficulty": 4,
  "expiresAt": "2026-04-05T12:00:00.000Z",
  "signature": "server-generated-hmac"
}
```

Server rules:

- `sessionId` should be unique.
- `nonce` should be random.
- `difficulty` should usually be between `3` and `5`.
- `expiresAt` should be short-lived, for example `10-30` minutes.
- `signature` should be an HMAC or equivalent server-side signature over the session fields.

Suggested signature payload:

```text
sessionId:installId:nonce:difficulty:expiresAt
```

### `POST /api/aicmd/events`

Used for consented usage analytics.

Headers expected from the client:

- `X-AI-CMD-Install-Id`
- `X-AI-CMD-Session-Id`
- `X-AI-CMD-Session-Expires`
- `X-AI-CMD-Session-Signature`

Body:

```json
{
  "payload": {
    "installId": "76f7075b-1d24-46d3-b037-78c4b6460a4b",
    "app": "ai-cmd",
    "version": "1.0.3",
    "time": "2026-04-05T11:25:00.000Z",
    "event": "prompt_sent",
    "os": "linux",
    "shell": "bash",
    "provider": "openai",
    "mode": "one-shot"
  },
  "auth": {
    "payloadHash": "sha256-of-payload-json",
    "counter": 18342,
    "proof": "sha256(sessionId:nonce:payloadHash:counter)"
  }
}
```

Event values currently used:

- `cli_started`
- `prompt_sent`

### `POST /api/aicmd/errors`

Used for consented runtime error reports.

Body:

```json
{
  "payload": {
    "installId": "76f7075b-1d24-46d3-b037-78c4b6460a4b",
    "app": "ai-cmd",
    "version": "1.0.3",
    "time": "2026-04-05T11:25:00.000Z",
    "event": "error_reported",
    "prompt": "restart nginx",
    "os": "linux",
    "shell": "bash",
    "provider": "openai",
    "message": "Failed to generate command: provider returned invalid JSON.",
    "code": "ResponseValidationError"
  },
  "auth": {
    "payloadHash": "sha256-of-payload-json",
    "counter": 9912,
    "proof": "sha256(sessionId:nonce:payloadHash:counter)"
  }
}
```

## Verification Logic

For `/events` and `/errors`, your server should:

1. Read and validate the headers.
2. Rebuild the signed session payload from the stored or derived session values.
3. Verify `X-AI-CMD-Session-Signature` using your server secret.
4. Reject expired sessions.
5. Recompute the request `payloadHash`.
6. Recompute `sha256(sessionId:nonce:payloadHash:counter)`.
7. Check that the resulting hash starts with `difficulty` leading zeroes in hex.
8. Optionally reject reused `(sessionId, counter)` pairs to reduce replay spam.
9. Validate the analytics payload schema.
10. Store the event and return `204 No Content`.

## Suggested Database Schema

### `analytics_sessions`

```sql
create table analytics_sessions (
  session_id uuid primary key,
  install_id uuid not null,
  nonce text not null,
  difficulty integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index analytics_sessions_install_id_idx on analytics_sessions (install_id);
create index analytics_sessions_expires_at_idx on analytics_sessions (expires_at);
```

### `analytics_events`

```sql
create table analytics_events (
  id bigserial primary key,
  install_id uuid not null,
  app text not null,
  version text not null,
  event text not null,
  os text,
  shell text,
  provider text,
  mode text,
  created_at timestamptz not null
);

create index analytics_events_install_id_idx on analytics_events (install_id);
create index analytics_events_event_idx on analytics_events (event);
create index analytics_events_created_at_idx on analytics_events (created_at);
```

### `analytics_errors`

```sql
create table analytics_errors (
  id bigserial primary key,
  install_id uuid not null,
  app text not null,
  version text not null,
  event text not null,
  prompt text,
  os text,
  shell text,
  provider text,
  message text not null,
  code text,
  created_at timestamptz not null
);

create index analytics_errors_install_id_idx on analytics_errors (install_id);
create index analytics_errors_created_at_idx on analytics_errors (created_at);
```

## Metrics You Can Query

### Anonymous users

```sql
select count(distinct install_id) as users
from analytics_events;
```

### Prompt count

```sql
select count(*) as prompts_sent
from analytics_events
where event = 'prompt_sent';
```

### Active users by day

```sql
select date_trunc('day', created_at) as day, count(distinct install_id) as users
from analytics_events
group by 1
order by 1 desc;
```

### Error volume

```sql
select date_trunc('day', created_at) as day, count(*) as errors
from analytics_errors
group by 1
order by 1 desc;
```

## Recommended Infra

- Reverse proxy: Nginx or Caddy
- Runtime: Node.js, Bun, Go, PHP, or any small JSON API
- Database: PostgreSQL
- TLS: Let's Encrypt or Cloudflare
- Logging: redact request bodies from default access logs if you store prompts in error reports
- Rate limiting: enforce limits at both proxy and application layers

## Retention

- Keep usage events longer if needed for product trends.
- Apply a shorter retention window for error reports because prompts may be present.
- Expire old sessions aggressively.
- Document the retention period publicly if you ship analytics in a public CLI.
