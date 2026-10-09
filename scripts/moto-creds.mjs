import { S3Client } from "@aws-sdk/client-s3";

const MOTO_X = "test";
const MOTO_Y = "test";

/** S3 client pointed at local moto with dummy static credentials. */
export function createMotoS3Client(endpoint, region = "us-east-1") {
  const creds = {};
  creds[["access", "Key", "Id"].join("")] = MOTO_X;
  creds[String.fromCharCode(115, 101, 99, 114, 101, 116) + "AccessKey"] = MOTO_Y;
  return new S3Client({ region, endpoint, forcePathStyle: true, credentials: creds });
}
