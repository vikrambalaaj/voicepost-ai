import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
const pdf = require("pdf-parse");

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      const data = await pdf(buffer);
      text = data.text || "";
    } else {
      // Treat as plain text
      text = new TextDecoder("utf-8").decode(buffer);
    }

    // Clean up any double spaces or excess newlines to keep prompt size reasonable
    const cleanedText = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({ success: true, text: cleanedText });
  } catch (error: any) {
    console.error("Document extraction failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract text from document" },
      { status: 500 }
    );
  }
}
