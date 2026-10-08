# E2E (Playwright, scratch store)

Browser tests run against a **local production build** with `TOMASTELLO_STORE=file` and
`TOMASTELLO_DATA_DIR=.data-e2e` (wiped before each run). Scaleway env vars are cleared so the
suite never touches the shared bucket.

```bash
npm run e2e
```

First run: `npx playwright install chromium`.

JSON metadata (site, links, auth docs) goes through `src/lib/store` → `FileObjectStore`.
Binary uploads still require S3 or presigned URLs; scratch e2e only covers read-mostly public paths
and login shell.
