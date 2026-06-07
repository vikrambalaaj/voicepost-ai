import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { Resend } from "resend";
import nodemailer from "nodemailer";

// Render a beautiful HTML email for the draft post notification
function buildEmailHtml({
  recipientName,
  postContent,
  hashtags,
  approvalUrl,
}: {
  recipientName: string;
  postContent: string;
  hashtags: string[];
  approvalUrl: string;
}): string {
  const hashtagPills = hashtags
    .map(
      (tag) =>
        `<span style="display:inline-block;background:#EFF6FF;color:#1D4ED8;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin:3px 3px 0 0;font-family:sans-serif;">#${tag}</span>`
    )
    .join("");

  // Safely encode post content for HTML display
  const safeContent = postContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your LinkedIn Draft is Ready</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <div style="display:inline-flex;align-items:center;gap:8px;">
                <div style="width:36px;height:36px;background:linear-gradient(135deg,#3B82F6,#8B5CF6);border-radius:10px;display:inline-block;"></div>
                <span style="font-size:20px;font-weight:800;color:#18181B;letter-spacing:-0.5px;">VoicePost</span>
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#FFFFFF;border-radius:20px;padding:32px;border:1px solid #E4E4E7;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#18181B;line-height:1.3;">
                ✍️ Your draft is ready, ${recipientName.split(" ")[0]}
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#71717A;line-height:1.6;">
                Your voice memo has been turned into a LinkedIn post. Review it before it goes live.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #F4F4F5;margin:0 0 24px;" />

              <!-- LinkedIn Preview Card -->
              <div style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:14px;padding:20px;margin-bottom:20px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.8px;">LinkedIn Preview</p>
                <p style="margin:12px 0 16px;font-size:14px;color:#27272A;line-height:1.7;white-space:pre-wrap;">${safeContent}</p>
                ${hashtagPills ? `<div style="margin-top:12px;">${hashtagPills}</div>` : ""}
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${approvalUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#8B5CF6);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:14px;letter-spacing:-0.2px;">
                      Review &amp; Publish →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info note -->
              <p style="margin:0;font-size:12px;color:#A1A1AA;text-align:center;line-height:1.6;">
                Nothing will be posted until you approve it. You can also edit the content and hashtags before publishing.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;" align="center">
              <p style="margin:0;font-size:11px;color:#A1A1AA;">
                VoicePost · Auto-generated draft notification · <a href="${approvalUrl}" style="color:#A1A1AA;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendApprovalEmailInternal({
  post_id,
  post_content,
  hashtags = [],
  baseUrl,
}: {
  post_id: string;
  post_content: string;
  hashtags?: string[];
  baseUrl: string;
}) {
  const db = getServiceSupabase();

  // 1. Fetch post to get user_id
  const { data: post } = await db
    .from("posts")
    .select("user_id")
    .eq("id", post_id)
    .single();

  let recipientEmail = "demo@voicepost.com";
  let recipientName = "there";

  if (post && post.user_id) {
    const { data: user } = await db
      .from("users")
      .select("email, full_name")
      .eq("id", post.user_id)
      .single();
    if (user) {
      recipientEmail = user.email || recipientEmail;
      recipientName = user.full_name || recipientName;
    }
  } else {
    // Fallback: Get first user in DB
    const { data: users } = await db
      .from("users")
      .select("email, full_name")
      .limit(1);
    const fallbackUser = users?.[0];
    recipientEmail = fallbackUser?.email || recipientEmail;
    recipientName = fallbackUser?.full_name || recipientName;
  }

  const finalApprovalUrl = `${baseUrl}/posts/${post_id}/approval`;
  const htmlBody = buildEmailHtml({
    recipientName,
    postContent: post_content,
    hashtags,
    approvalUrl: finalApprovalUrl,
  });

  const subject = "📝 Your LinkedIn Draft is Ready for Review";

  // 1. Try sending via SMTP if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const port = parseInt(smtpPort || "587", 10);
      const secure = process.env.SMTP_SECURE === "true" || port === 465;
      const fromEmail = process.env.SMTP_FROM || `VoicePost <${smtpUser}>`;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: port,
        secure: secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false // avoids SSL certificate issues for custom mail servers
        }
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject,
        html: htmlBody,
      });

      console.log(`[notify/email] Email sent via SMTP to ${recipientEmail} — MessageId: ${info.messageId}`);
      return {
        success: true,
        method: "smtp",
        message_id: info.messageId,
        recipient: recipientEmail,
      };
    } catch (smtpErr: any) {
      console.error("[notify/email] SMTP sending failed, falling back to Resend:", smtpErr);
    }
  }

  // 2. Fallback to Resend
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    // No SMTP or Resend key — print to console as fallback
    console.log("\n=== 📧 DRAFT EMAIL NOTIFICATION (Console Fallback — set RESEND_API_KEY or SMTP credentials to send real emails) ===");
    console.log(`To:      ${recipientEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Draft:   ${post_content.substring(0, 200)}...`);
    console.log(`Tags:    ${hashtags.map((h: string) => `#${h}`).join(" ")}`);
    console.log(`Review:  ${finalApprovalUrl}`);
    console.log("================================================================================\n");

    return {
      success: true,
      method: "console_log",
      recipient: recipientEmail,
    };
  }

  // Send via Resend
  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "VoicePost <noreply@resend.dev>";

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: fromEmail,
    to: [recipientEmail],
    subject,
    html: htmlBody,
  });

  if (emailError) {
    console.error("[notify/email] Resend error:", emailError);
    console.log("\n=== 📧 DRAFT EMAIL NOTIFICATION (Resend Sandboxed Fallback) ===");
    console.log(`To:      ${recipientEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Draft:   ${post_content.substring(0, 200)}...`);
    console.log(`Error:   ${emailError.message}`);
    console.log("================================================================================\n");

    return {
      success: true,
      method: "console_log_fallback",
      error: emailError.message,
      recipient: recipientEmail,
    };
  }

  console.log(`[notify/email] Email sent to ${recipientEmail} — ID: ${emailData?.id}`);

  return {
    success: true,
    method: "resend",
    email_id: emailData?.id,
    recipient: recipientEmail,
  };
}

export async function POST(req: NextRequest) {
  try {
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
