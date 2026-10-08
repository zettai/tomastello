import swaggerSpec from "@/lib/swagger";
import { NextResponse } from "next/server";
import { apiDocsEnabled } from "@/lib/apiDocs";

/**
 * @swagger
 * /api/swagger:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the OpenAPI/Swagger specification for this API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  if (!apiDocsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(swaggerSpec);
}
