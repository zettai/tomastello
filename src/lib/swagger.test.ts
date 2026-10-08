import swaggerJSDoc from "swagger-jsdoc";
import { options } from "./swagger";

interface SwaggerSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: {
      name: string;
      url: string;
    };
  };
}

describe("swagger", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("options", () => {
    it("should have correct OpenAPI version", () => {
      expect(options.definition.openapi).toBe("3.0.0");
    });

    it("should have correct API info", () => {
      expect(options.definition.info).toEqual({
        title: "Tomás Tello Website API",
        version: "1.0.0",
        description:
          "API behind the Tomás Tello website: auth, site content, links, photos and audio, stored in Scaleway Object Storage",
        contact: {
          name: "API Support",
          url: "http://localhost:3000",
        },
      });
    });

    it("should use default server URL when env var is not set", () => {
      expect(options.definition.servers[0]).toEqual({
        url: "http://localhost:3000",
        description: "Development server",
      });
    });

    it("should use custom server URL from environment", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      const { options: updatedOptions } = await import("./swagger");
      expect(updatedOptions.definition.servers[0].url).toBe(
        "https://example.com"
      );
    });

    it("should have required security schemes", () => {
      expect(options.definition.components.securitySchemes).toHaveProperty(
        "cookieAuth"
      );
      expect(options.definition.components.securitySchemes.cookieAuth).toEqual({
        type: "apiKey",
        in: "cookie",
        name: "auth-token",
        description: "Authentication cookie set by login endpoint",
      });
    });

    it("should have required schemas", () => {
      const schemas = options.definition.components.schemas;
      expect(schemas).toHaveProperty("User");
      expect(schemas).toHaveProperty("ImageMetadata");
      expect(schemas).toHaveProperty("Error");
      expect(schemas).toHaveProperty("Success");
      expect(schemas).toHaveProperty("SiteData");
    });

    it("should have required paths", () => {
      expect(options.definition.paths).toHaveProperty("/api/site");
      expect(options.definition.paths["/api/site"]).toHaveProperty("get");
    });

    it("should generate valid swagger spec", () => {
      const spec = swaggerJSDoc(options) as SwaggerSpec;
      expect(spec).toBeDefined();
      expect(spec.openapi).toBe("3.0.0");
      expect(spec.info.title).toBe("Tomás Tello Website API");
    });
  });
});
