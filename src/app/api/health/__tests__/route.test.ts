import { GET, POST } from "../route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
  },
}));

describe("Health API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should report only that the app is up", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      // No made-up service statuses, version or environment.
      expect(data).toEqual({ status: "ok" });
    });
  });

  describe("POST", () => {
    it("should return 405 Method Not Allowed", async () => {
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data).toHaveProperty(
        "message",
        "Health check endpoint supports GET requests only"
      );
    });
  });
});
