jest.mock("./api", () => ({
  SCALEWAY_BUCKET: "test-bucket",
  presignClient: { config: {} },
}));
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://signed.example"),
}));

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { presignObjectPut, presignUploadPart } from "./presign";

type SignCall = [unknown, { input: Record<string, unknown> }, { expiresIn: number; signableHeaders: Set<string> }];

describe("presign", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should sign an object PUT with type, size and a 5 minute expiry", async () => {
    await expect(presignObjectPut("images/1-a.jpg", "image/jpeg", 123)).resolves.toBe("https://signed.example");
    const [, command, options] = (getSignedUrl as jest.Mock).mock.calls[0] as SignCall;
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "images/1-a.jpg",
      ContentType: "image/jpeg",
      ContentLength: 123,
      ACL: "public-read",
    });
    expect(options.expiresIn).toBe(300);
    expect(Array.from(options.signableHeaders).sort((a, b) => a.localeCompare(b))).toEqual(["content-length", "content-type"]);
  });

  it("should sign an upload part with its size", async () => {
    await presignUploadPart("audio/1-a.mp3", "up-1", 3, 999);
    const [, command, options] = (getSignedUrl as jest.Mock).mock.calls[0] as SignCall;
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "audio/1-a.mp3",
      UploadId: "up-1",
      PartNumber: 3,
      ContentLength: 999,
    });
    expect(options.expiresIn).toBe(300);
    expect(Array.from(options.signableHeaders)).toEqual(["content-length"]);
  });
});
