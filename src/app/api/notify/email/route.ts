import { NextRequest, NextResponse } from "next/server";
import { sendApprovalEmailInternal } from "@/lib/email";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { post_id, post_content, hashtags = [] } = body;

    if (!post_id || !post_content) {
      return NextResponse.json({ error: "post_id and post_content are required" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const result = await sendApprovalEmailInternal({
      post_id,
      post_content,
      hashtags,
      baseUrl,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[notify/email] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
