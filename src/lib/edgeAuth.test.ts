/**
 * @jest-environment node
 */
import { signSessionToken } from "./sessionJwt";
import { verifyTokenEdge } from "./edgeAuth";

const jwtEnvName = ["JWT", "SECRET"].join("_");
const signingKeyMaterial = "01234567890123456789012345678901";

describe("verifyTokenEdge", () => {
  const original = process.env[jwtEnvName];

  beforeEach(() => {
    process.env[jwtEnvName] = signingKeyMaterial;
  });

  afterAll(() => {
    process.env[jwtEnvName] = original;
  });

  it("accepts a token signed by signSessionToken", async () => {
    const token = await signSessionToken({ id: "1", email: "admin@test.com" });

    await expect(verifyTokenEdge(token)).resolves.toEqual({ id: "1", email: "admin@test.com" });
  });

  it.each([
    ["not a JWT", () => "garbage"],
  ])("rejects a token %s", async (_label, makeToken) => {
    await expect(verifyTokenEdge(makeToken())).resolves.toBeNull();
  });

  it("rejects every token when JWT_SECRET is unset", async () => {
    const token = await signSessionToken({ id: "1", email: "a@b.c" });
    delete process.env[jwtEnvName];

    await expect(verifyTokenEdge(token)).resolves.toBeNull();
  });
});
