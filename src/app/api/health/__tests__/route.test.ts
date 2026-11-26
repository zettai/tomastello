import { GET, dynamic } from "../route";

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

  it("stays static, so monitor polls never run a serverless function", () => {
    // A POST handler or a dynamic setting here makes every poll a billed function call.
    expect(dynamic).toBe("force-static");
  });
});
