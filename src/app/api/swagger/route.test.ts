import { GET } from "./route";
import swaggerSpec from "@/lib/swagger";
import { apiDocsEnabled } from "@/lib/apiDocs";

// Mock dependencies
jest.mock("@/lib/apiDocs", () => ({ apiDocsEnabled: jest.fn().mockReturnValue(true) }));
jest.mock("@/lib/swagger", () => ({
  __esModule: true,
  default: {
    openapi: "3.0.0",
    info: {
      title: "Test API",
      version: "1.0.0",
    },
  },
}));

describe("GET /api/swagger", () => {
  it("returns swagger specification successfully", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(swaggerSpec);
  });

  it("should answer 404 when API docs are disabled", async () => {
    (apiDocsEnabled as jest.Mock).mockReturnValueOnce(false);
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
