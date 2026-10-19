import { NextResponse } from "next/server";
import { readProfessionalPhoto } from "@/lib/storage/photos";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;

  try {
    const photo = await readProfessionalPhoto(filename);
    if (!photo) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(photo.body), {
      status: 200,
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
