# Uploads

Photos and audio can reach the bucket in two ways, chosen at runtime with `UPLOAD_MODE`.

| | `relay` (default) | `presigned` |
|---|---|---|
| Path of the bytes | browser → API route → bucket | browser → bucket |
| Request body through the server | the whole file (audio in chunks) | none: only small JSON |
| Works on hosts with a body cap (Netlify functions: 6 MB) | no | yes |
| Needs bucket CORS rules | no | **yes** (below) |

Switching is a settings change only: set `UPLOAD_MODE=presigned` and restart. The browser asks
`GET /api/uploads/config` before each upload, so no rebuild is needed. Set it back to `relay`
to undo.

## Flows

**Photos (presigned):**
1. `POST /api/images/upload/presign` `{ fileName, contentType, size }`: the server checks the
   type (JPEG, PNG, WebP, GIF, AVIF) and size (≤ 30 MB), picks the key
   (`images/<timestamp>-<name>`) and returns a URL valid for 5 minutes plus the headers to send.
2. The browser `PUT`s the file to that URL.
3. `POST /api/images/upload/complete` `{ key, originalName }`: the server reads the object's real
   size and type from the bucket (HEAD), deletes it if it breaks the limits, sets `public-read`
   ACL (browser presigned PUTs cannot send ACL headers), and saves metadata.

**Audio (both modes):** `multipart/init` and `multipart/complete` are unchanged JSON calls.
- relay: each chunk is `PUT` to `/api/audio/upload/multipart/part`, which forwards it.
- presigned: for each chunk the browser calls `GET /api/audio/upload/multipart/part?…&size=`
  to get a signed `UploadPart` URL, `PUT`s the chunk there and reads the part's `ETag` from the
  response header. Small files use a single part, so nothing goes through `/api/audio/upload`.
- `complete` reads the object's real size from the bucket and deletes it if it is over 100 MB.

## Safeguards

- Auth is checked before anything is signed; signed URLs expire after 5 minutes.
- The server picks every key; routes that take a key accept only the shapes it makes
  (`audio/<digits>-<name>`, `images/<digits>-<name>`), never `auth/` or `metadata/`.
- `Content-Length` (and, for photos, `Content-Type`) are part of the signature: the bucket
  refuses a body of another size or type.
- Metadata uses the size and type the bucket reports, not what the browser claimed.

## Bucket CORS (required before `presigned`)

Browsers only allow the direct `PUT` if the bucket answers CORS for the site's origin, and the
audio flow needs the `ETag` response header exposed. Example rules (replace the origins):

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://tomas-tello.stream", "https://<preview-site>.netlify.app"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["content-type"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

Apply with any S3 client pointed at the bucket's endpoint, for example
`aws s3api put-bucket-cors --bucket <bucket> --cors-configuration file://cors.json --endpoint-url <endpoint>`.
Keep `GET` for public reads as it is today; these rules only add the upload path.

## Chunk size

`UPLOAD_CHUNK_SIZE_MB` (default 5, clamped to 5–64) is read by the server at runtime and sent to
the browser with the mode. It used to be read only at build time as
`NEXT_PUBLIC_UPLOAD_CHUNK_SIZE_MB`, so the value passed to the container did nothing.
