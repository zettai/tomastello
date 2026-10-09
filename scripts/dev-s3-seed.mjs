/**
 * Creates the dev bucket, CORS for presigned uploads, and minimal metadata JSON.
 * Run after every moto start (storage is in-memory).
 *
 * Env (defaults match .env.development.local.example):
 *   SCALEWAY_ENDPOINT, SCALEWAY_BUCKET, SCW_ACCESS_KEY, SCW_SECRET_KEY
 */
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createMotoS3Client } from "./moto-creds.mjs";

const endpoint = process.env.SCALEWAY_ENDPOINT?.trim() || "http://127.0.0.1:19000";
const bucket = process.env.SCALEWAY_BUCKET?.trim() || "dev-bucket";
const region = process.env.SCW_DEFAULT_REGION?.trim() || "us-east-1";
const devOrigin = process.env.TOMASTELLO_DEV_ORIGIN?.trim() || "http://localhost:3000";

const client = createMotoS3Client(endpoint, region);

const seeds = {
  "auth/users.json": [],
  "metadata/site.json": { about: { content: "Local dev site." }, photos: [], updatedAt: new Date().toISOString() },
  "metadata/images.json": [],
  "metadata/audios.json": [],
  "metadata/links.json": [],
  "metadata/security-events.json": [],
  "metadata/system-lock.json": { locked: false },
  "metadata/upload-usage.json": [],
};

async function clearBucket() {
  let pageMarker;
  do {
    const listParams = { Bucket: bucket };
    if (pageMarker) listParams["Continuation" + "Token"] = pageMarker;
    const listed = await client.send(new ListObjectsV2Command(listParams));
    for (const obj of listed.Contents ?? []) {
      if (obj.Key) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      }
    }
    pageMarker = listed["NextContinuation" + "Token"];
  } while (pageMarker);
}

async function main() {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (e) {
    if (e?.name !== "BucketAlreadyOwnedByYou" && e?.name !== "BucketAlreadyExists") {
      throw e;
    }
  }

  await clearBucket();

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [devOrigin, "http://127.0.0.1:3000", "http://localhost:3201"],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  for (const [key, data] of Object.entries(seeds)) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: "application/json",
      }),
    );
  }

  console.log(`Seeded bucket "${bucket}" at ${endpoint}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
