import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

// Scaleway Object Storage configuration
const clientConfig: S3ClientConfig = {
  region: process.env.SCW_DEFAULT_REGION || "fr-par",
  endpoint: process.env.SCALEWAY_ENDPOINT || "https://s3.fr-par.scw.cloud",
  credentials: {
    accessKeyId: process.env.SCW_ACCESS_KEY!,
    secretAccessKey: process.env.SCW_SECRET_KEY!,
  },
  forcePathStyle: true, // Required for Scaleway compatibility
};

export const scalewayClient = new S3Client(clientConfig);

/**
 * Client for presigning only. The SDK otherwise adds a default CRC32 checksum computed over
 * the (empty) body at signing time, which a bucket that checks it would reject.
 */
export const presignClient = new S3Client({ ...clientConfig, requestChecksumCalculation: "WHEN_REQUIRED" });

export const SCALEWAY_BUCKET = process.env.SCALEWAY_BUCKET!;
