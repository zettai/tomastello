jest.mock("./api", () => ({
  SCALEWAY_BUCKET: "test-bucket",
  scalewayClient: { send: jest.fn() },
}));

import { scalewayClient } from "./api";
import { deleteObject, headObject } from "./objects";

describe("objects", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return size and type from HEAD", async () => {
    (scalewayClient.send as jest.Mock).mockResolvedValue({ ContentLength: 10, ContentType: "image/png" });
    await expect(headObject("images/1-a.png")).resolves.toEqual({ size: 10, contentType: "image/png" });
  });

  it("should default missing HEAD fields", async () => {
    (scalewayClient.send as jest.Mock).mockResolvedValue({});
    await expect(headObject("images/1-a.png")).resolves.toEqual({ size: 0, contentType: "" });
  });

  it.each(["NotFound", "NoSuchKey"])("should return null when HEAD fails with %s", async (name) => {
    (scalewayClient.send as jest.Mock).mockRejectedValue(Object.assign(new Error("gone"), { name }));
    await expect(headObject("images/1-a.png")).resolves.toBeNull();
  });

  it("should rethrow other errors", async () => {
    (scalewayClient.send as jest.Mock).mockRejectedValue(new Error("network"));
    await expect(headObject("images/1-a.png")).rejects.toThrow("network");
  });

  it("should delete the object", async () => {
    (scalewayClient.send as jest.Mock).mockResolvedValue({});
    await deleteObject("images/1-a.png");
    const [command] = (scalewayClient.send as jest.Mock).mock.calls[0] as [{ input: Record<string, unknown> }];
    expect(command.input).toEqual({ Bucket: "test-bucket", Key: "images/1-a.png" });
  });
});
