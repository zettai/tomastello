import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { scalewayClient, SCALEWAY_BUCKET } from "@/lib/api";
import { verifyToken } from "@/lib/auth";
import { publicObjectUrl } from "@/lib/uploads";

// Admin only: lists every object, including images that aren't published.
export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: SCALEWAY_BUCKET,
      Prefix: "images/",
      MaxKeys: 100,
    });

    const response = await scalewayClient.send(command);

    const images =
      response.Contents?.map((object) => ({
        key: object.Key,
        url: publicObjectUrl(object.Key!),
        size: object.Size,
        lastModified: object.LastModified,
      })) || [];

    return NextResponse.json({
      success: true,
      images: images.toSorted(
        (a, b) =>
          new Date(b.lastModified!).getTime() -
          new Date(a.lastModified!).getTime()
      ),
    });
  } catch (error) {
    console.error("List images error:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }
}
