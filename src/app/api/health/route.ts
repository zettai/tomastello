import { NextResponse } from "next/server";

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Liveness check
 *     description: Answers 200 while the app is serving requests. It does not check the bucket or any other service, so it reports nothing it doesn't know.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: The app is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST() {
  return NextResponse.json(
    {
      message: "Health check endpoint supports GET requests only",
    },
    { status: 405 }
  );
}
