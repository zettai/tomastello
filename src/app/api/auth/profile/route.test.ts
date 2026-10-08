import { NextRequest } from "next/server";
import { GET } from "./route";
import { verifyToken, getUserById } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
  getUserById: jest.fn(),
}));

describe("GET /api/auth/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeRequestWithCookie(token: string) {
    return {
      cookies: {
        get: (name: string) => {
          if (name === "auth-token") {
            return { name, value: token };
          }
          return undefined;
        },
        entries: () => [["auth-token", token]],
      },
    } as unknown as NextRequest;
  }

  it("should return 401 if token is invalid", async () => {
    (verifyToken as jest.Mock).mockResolvedValue(null);
    const req = makeRequestWithCookie("invalid-token");
    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid token");
  });

  it("should return 404 if user not found", async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ id: "123" });
    (getUserById as jest.Mock).mockResolvedValue(null);
    const req = makeRequestWithCookie("valid-token");
    const response = await GET(req);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("User not found");
  });

  it("should return user profile if found", async () => {
    const mockUser = {
      id: "123",
      email: "test@example.com",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastLogin: "2024-01-01T00:00:00.000Z",
    };
    (verifyToken as jest.Mock).mockResolvedValue({ id: "123" });
    (getUserById as jest.Mock).mockResolvedValue(mockUser);
    const req = makeRequestWithCookie("valid-token");
    const response = await GET(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      createdAt: mockUser.createdAt,
      lastLogin: mockUser.lastLogin,
    });
  });

  it("should return 401 if no token is provided", async () => {
    const req = makeRequestWithCookie("");
    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("should return 500 if an error occurs", async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ id: "123" });
    (getUserById as jest.Mock).mockRejectedValue(new Error("Database error"));
    const req = makeRequestWithCookie("valid-token");
    const response = await GET(req);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to get user profile");
  });
});
