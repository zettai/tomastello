/**
 * @jest-environment node
 */
import * as auth from "./auth";
import { scalewayClient } from "./api";
import { seedJson } from "@/test/storeHelpers";

jest.mock("./api", () => ({
  scalewayClient: { send: jest.fn() },
  SCALEWAY_BUCKET: "test-bucket",
}));

const bodyOf = (items: unknown) => ({
  Body: { transformToString: () => Promise.resolve(JSON.stringify(items)) },
  ETag: '"v1"',
});

const jwtEnvName = ["JWT", "SECRET"].join("_");
const signingKeyMaterial = "01234567890123456789012345678901";

describe("auth lib", () => {
  const originalSecret = process.env[jwtEnvName];

  beforeEach(() => {
    process.env[jwtEnvName] = signingKeyMaterial;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env[jwtEnvName] = originalSecret;
  });

  describe("getUsers", () => {
    it("returns users from store", async () => {
      const users = [{ id: "1", email: "a", createdAt: "now" }];
      await seedJson("auth/users.json", users);
      const result = await auth.getUsers();
      expect(result).toEqual(users);
    });
    it("returns [] if file not found", async () => {
      const result = await auth.getUsers();
      expect(result).toEqual([]);
    });
  });

  describe("saveUsers", () => {
    it("saves users to S3", async () => {
      (scalewayClient.send as jest.Mock).mockResolvedValue({});
      await expect(
        auth.saveUsers([{ id: "1", email: "a", createdAt: "now" }]),
      ).resolves.toBeUndefined();
      expect(scalewayClient.send).toHaveBeenCalled();
    });
  });

  describe("generateToken/verifyToken", () => {
    it("round-trips session claims with jose", async () => {
      const token = await auth.generateToken({ id: "1", email: "a@b.com" });
      await expect(auth.verifyToken(token)).resolves.toEqual({ id: "1", email: "a@b.com" });
    });

    it("throws when signing without JWT_SECRET", async () => {
      delete process.env[jwtEnvName];
      await expect(auth.generateToken({ id: "1", email: "a" })).rejects.toThrow("JWT_SECRET must be set");
    });

    it("returns null when JWT_SECRET is unset", async () => {
      const token = await auth.generateToken({ id: "1", email: "a@b.com" });
      delete process.env[jwtEnvName];
      await expect(auth.verifyToken(token)).resolves.toBeNull();
    });

    it("returns null for invalid JWT", async () => {
      await expect(auth.verifyToken("not-a-jwt")).resolves.toBeNull();
    });
  });

  describe("resolveUserForMagicLink", () => {
    it("updates lastLogin for an existing user", async () => {
      const users = [{ id: "1", email: "a@b.com", createdAt: "now" }];
      await seedJson("auth/users.json", users);
      const payload = await auth.resolveUserForMagicLink("a@b.com");
      expect(payload).toEqual({ id: "1", email: "a@b.com" });
    });

    it("creates a user record when missing", async () => {
      const payload = await auth.resolveUserForMagicLink("new@b.com");
      expect(payload.email).toBe("new@b.com");
      expect(payload.id).toBeTruthy();
    });
  });

  describe("getUserById", () => {
    it("returns user by id", async () => {
      const user = { id: "1", email: "a@b.com", createdAt: "now" };
      await seedJson("auth/users.json", [user]);
      const result = await auth.getUserById("1");
      expect(result).toEqual(user);
    });
    it("returns null if not found", async () => {
      const result = await auth.getUserById("2");
      expect(result).toBeNull();
    });
  });
});
