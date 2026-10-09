# Local S3 dev (moto)

Dev against an in-memory S3 mock so `npm run dev` never calls `*.scw.cloud`.

## Start / stop

```bash
./scripts/dev-s3-up.sh    # podman or docker compose + seed
./scripts/dev-s3-down.sh
```

Re-run `./scripts/dev-s3-seed.mjs` after every moto restart (data is not persisted).

## Env (copy into `.env.development.local`)

Dummy values only:

| Variable | Example |
|---|---|
| `TOMASTELLO_STORE` | `s3` |
| `TOMASTELLO_DATA_DIR` | `.data-dev` |
| `JWT_SECRET` | dev-only signing string (32+ chars) |
| `TOMASTELLO_ADMIN_EMAILS` | `editor@example.com` |
| `TOMASTELLO_SITE_URL` | `http://localhost:3000` |
| `UPLOAD_MODE` | `presigned` |
| `SCW_ACCESS_KEY` / `SCW_SECRET_KEY` | `testing` / `testing` |
| `SCW_DEFAULT_REGION` | `us-east-1` |
| `SCALEWAY_BUCKET` | `dev-bucket` |
| `SCALEWAY_ENDPOINT` | `http://127.0.0.1:19000` |
| `SCALEWAY_PUBLIC_BASE_URL` | `http://127.0.0.1:19000/dev-bucket` |
| `RESEND_API_KEY` | empty (magic links go to `TOMASTELLO_DATA_DIR/outbox/`) |

**S3 / store / uploads / bucket JSON (must override `.env.local` for mock):**  
`TOMASTELLO_STORE`, `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`, `SCW_DEFAULT_REGION`, `SCALEWAY_BUCKET`, `SCALEWAY_ENDPOINT`, `SCALEWAY_PUBLIC_BASE_URL`, `UPLOAD_MODE`.

**Auth + dev mail (upload routes):** `JWT_SECRET`, `TOMASTELLO_ADMIN_EMAILS`, `TOMASTELLO_DATA_DIR`, `RESEND_API_KEY` (empty → console outbox).

**Site origin (magic links):** `TOMASTELLO_SITE_URL`.

**Optional (defaults work on mock):** `UPLOAD_CHUNK_SIZE_MB` (5), `MAX_UPLOADS_PER_IP_HOUR`, `MAX_UPLOADS_PER_USER_HOUR`, `MAX_SYSTEM_BYTES_24H`.

Then: `npm run dev` (with moto up). Presigned uploads should use `127.0.0.1:19000`, not `scw.cloud`.

## E2E against the mock

```bash
npm run e2e:local-s3
```

Starts moto, seeds, builds Next with the mock env, and runs `e2e/local-s3-mock.spec.ts`.
