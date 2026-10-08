import { POST } from "./route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data) => ({
      ...data,
      cookies: {
        set: jest.fn(),
      },
    })),
  },
}));

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 and success message", async () => {
    const response = await POST();
    const data = response as unknown as {
      success: boolean;
      message: string;
      cookies: { set: jest.Mock };
    };
    expect(data.success).toBe(true);
    expect(data.message).toBe("Logged out successfully");
    expect(data.cookies.set).toHaveBeenCalledWith("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
    });
  });
});
