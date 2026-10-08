import swaggerJSDoc from "swagger-jsdoc";

export const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tomás Tello Website API",
      version: "1.0.0",
      description:
        "API behind the Tomás Tello website: auth, site content, links, photos and audio, stored in Scaleway Object Storage",
      contact: {
        name: "API Support",
        url: "http://localhost:3000",
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "auth-token",
          description: "Authentication cookie set by login endpoint",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique user identifier",
            },
            username: {
              type: "string",
              description: "Username for login",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
            },
          },
        },
        ImageMetadata: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique image identifier",
            },
            fileName: {
              type: "string",
              description: "Generated filename in storage",
            },
            originalName: {
              type: "string",
              description: "Original filename from upload",
            },
            url: {
              type: "string",
              format: "uri",
              description: "Public URL to access the image",
            },
            size: {
              type: "number",
              description: "File size in bytes",
            },
            type: {
              type: "string",
              description: "MIME type of the image",
            },
            uploadedAt: {
              type: "string",
              format: "date-time",
              description: "Upload timestamp",
            },
            uploadedBy: {
              type: "string",
              description: "Username of uploader",
            },
            description: {
              type: "string",
              description: "Custom description of the image",
              nullable: true,
            },
            alt: {
              type: "string",
              description: "Alternative text for accessibility",
              nullable: true,
            },
            tags: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of tags for categorization",
              nullable: true,
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            success: {
              type: "boolean",
              description: "Always false for error responses",
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Always true for successful responses",
            },
            message: {
              type: "string",
              description: "Success message",
              nullable: true,
            },
          },
        },
        SiteData: {
          type: "object",
          properties: {
            about: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description:
                    "About content with markdown support (max 2000 chars)",
                  maxLength: 2000,
                },
              },
              required: ["content"],
            },
            photos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "Unique identifier for the photo",
                  },
                  url: {
                    type: "string",
                    format: "uri",
                    description: "URL of the photo",
                  },
                },
                required: ["id", "url"],
              },
            },
          },
          required: ["about", "photos"],
        },
      },
    },
    paths: {
      "/api/site": {
        get: {
          summary: "Get site data",
          description: "Retrieve the site's about content and photos",
          tags: ["Site"],
          responses: {
            200: {
              description: "Site data retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/SiteData",
                  },
                },
              },
            },
            500: {
              description: "Failed to get site data",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
        put: {
          summary: "Update site data",
          description:
            "Update the site's about content and photos (requires authentication)",
          tags: ["Site"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SiteData",
                },
              },
            },
          },
          responses: {
            200: {
              description: "Site data updated successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/SiteData",
                  },
                },
              },
            },
            400: {
              description: "Invalid request data",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            401: {
              description: "Authentication required",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
            500: {
              description: "Failed to update site data",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Error",
                  },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and account management",
      },
      {
        name: "Images",
        description: "Image upload, download, and deletion",
      },
      {
        name: "Metadata",
        description: "Image metadata management",
      },
      {
        name: "System",
        description: "System health",
      },
      {
        name: "Site",
        description: "Site data management",
      },
    ],
  },
  apis: ["./src/app/api/**/*.ts"], // Path to the API files
};

const specs = swaggerJSDoc(options);
export default specs;
