/**
 * Read-only: list site.json photos whose object key is missing from the bucket.
 * Usage: set SCALEWAY_* (and bucket) like production, then `node scripts/audit-stale-site-photos.mjs`
 */
import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.SCALEWAY_ENDPOINT?.trim();
const bucket = process.env.SCALEWAY_BUCKET?.trim();
const region = process.env.SCW_DEFAULT_REGION?.trim() || "fr-par";
const accessKey = process.env.SCW_ACCESS_KEY?.trim();
const secretKey = process.env.SCW_SECRET_KEY?.trim();

if (!endpoint || !bucket || !accessKey || !secretKey) {
  console.error("Missing SCALEWAY_ENDPOINT, SCALEWAY_BUCKET, SCW_ACCESS_KEY, or SCW_SECRET_KEY");
  process.exit(1);
}

const client = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  forcePathStyle: true,
});

async function readSite() {
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: "metadata/site.json" })
  );
  const body = await res.Body.transformToString();
  return JSON.parse(body);
}

async function objectExists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e) {
    if (e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

const site = await readSite();
const photos = site.photos ?? [];
const stale = [];
for (const p of photos) {
  const key = p.id;
  if (!key || !(await objectExists(key))) stale.push(p);
}

console.log(JSON.stringify({ totalPhotos: photos.length, staleCount: stale.length, stale }, null, 2));
