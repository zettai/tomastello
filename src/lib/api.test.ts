import { S3Client } from "@aws-sdk/client-s3";

describe("api", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("scalewayClient", () => {
    it("should create S3Client with default configuration", async () => {
      jest.resetModules();
      delete process.env.SCW_DEFAULT_REGION;
      delete process.env.SCALEWAY_ENDPOINT;
      const { scalewayClient } = await import("./api");
      expect(scalewayClient.constructor.name).toBe("S3Client");
      expect(scalewayClient.config.region!()).resolves.toBe("fr-par");
      expect(scalewayClient.config.endpoint!()).resolves.toMatchObject({
        hostname: "s3.fr-par.scw.cloud",
        protocol: "https:",
      });
    });

    it("should use custom region from environment", () => {
      process.env.SCW_DEFAULT_REGION = "nl-ams";
      const client = new S3Client({
        region: process.env.SCW_DEFAULT_REGION || "fr-par",
        endpoint:
          process.env.SCALEWAY_ENDPOINT || "https://s3.fr-par.scw.cloud",
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
        forcePathStyle: true,
      });
      expect(client.config.region!()).resolves.toBe("nl-ams");
    });

    it("should use custom endpoint from environment", () => {
      process.env.SCALEWAY_ENDPOINT = "https://custom.endpoint.com";
      const client = new S3Client({
        region: process.env.SCW_DEFAULT_REGION || "fr-par",
        endpoint:
          process.env.SCALEWAY_ENDPOINT || "https://s3.fr-par.scw.cloud",
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
        forcePathStyle: true,
      });
      expect(client.config.endpoint!()).resolves.toMatchObject({
        hostname: "custom.endpoint.com",
        protocol: "https:",
      });
    });
  });

  describe("SCALEWAY_BUCKET", () => {
    it("should be defined from environment", async () => {
      process.env.SCALEWAY_BUCKET = "test-bucket";
      const { SCALEWAY_BUCKET: bucket } = await import("./api");
      expect(bucket).toBe("test-bucket");
    });
  });

  describe("presignClient", () => {
    it("should sign URLs without SDK default checksum parameters", async () => {
      process.env.SCW_ACCESS_KEY = "test-key";
      process.env.SCW_SECRET_KEY = "test-secret";
      const { PutObjectCommand } = jest.requireActual("@aws-sdk/client-s3");
      const { getSignedUrl } = jest.requireActual("@aws-sdk/s3-request-presigner");
      let presign: typeof import("./api").presignClient | undefined;
      jest.isolateModules(() => {
        presign = (jest.requireActual("./api") as typeof import("./api")).presignClient;
      });
      const url: string = await getSignedUrl(
        presign,
        new PutObjectCommand({ Bucket: "b", Key: "images/1-a.png", ContentType: "image/png", ContentLength: 3 }),
        { expiresIn: 60 }
      );
      expect(url).toContain("X-Amz-Signature=");
      expect(url).not.toMatch(/checksum/i);
    });
  });
});
