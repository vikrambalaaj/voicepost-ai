import { getServiceSupabase } from "@/lib/supabase";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { createEmailActionToken } from "@/lib/email-token";

// Render a beautiful HTML email for the draft post notification
function buildEmailHtml({
  recipientName,
  postContent,
  hashtags,
  approvalUrl,
  approveUrl,
  rejectUrl,
}: {
  recipientName: string;
  postContent: string;
  hashtags: string[];
  approvalUrl: string;
  approveUrl: string;
  rejectUrl: string;
}): string {
  const hashtagPills = hashtags
    .map(
      (tag) =>
        `<span style="display:inline-block;background:#EFF6FF;color:#1D4ED8;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin:3px 3px 0 0;font-family:sans-serif;">#${tag}</span>`
    )
    .join("");

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
                Your voice memo has been turned into a LinkedIn post. Approve it to queue for publishing, or request changes.
              </p>

              <hr style="border:none;border-top:1px solid #F4F4F5;margin:0 0 24px;" />

              <!-- LinkedIn Preview Card -->
              <div style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:14px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.8px;">LinkedIn Preview</p>
                <p style="margin:12px 0 16px;font-size:14px;color:#27272A;line-height:1.7;">${safeContent}</p>
                ${hashtagPills ? `<div style="margin-top:12px;">${hashtagPills}</div>` : ""}
              </div>

              <!-- One-Click Action Buttons -->
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#A1A1AA;text-align:center;text-transform:uppercase;letter-spacing:0.8px;">Quick Actions</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td width="48%" align="center">
                    <a href="${approveUrl}"
                       style="display:block;background:linear-gradient(135deg,#10B981,#059669);color:#FFFFFF;font-size:15px;font-weight:800;text-decoration:none;padding:16px 12px;border-radius:14px;text-align:center;">
                      ✅ Approve Post
                    </a>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" align="center">
                    <a href="${rejectUrl}"
                       style="display:block;background:#FFFFFF;color:#EF4444;font-size:15px;font-weight:800;text-decoration:none;padding:16px 12px;border-radius:14px;text-align:center;border:2px solid #EF4444;">
                      ❌ Request Changes
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Secondary CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${approvalUrl}"
                       style="display:inline-block;color:#6366F1;font-size:13px;font-weight:600;text-decoration:none;padding:8px 0;">
                      Open full editor to review &amp; edit content →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info note -->
              <p style="margin:0;font-size:12px;color:#A1A1AA;text-align:center;line-height:1.6;">
                One-click actions are valid for 7 days. Nothing is posted until you approve.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;" align="center">
              <p style="margin:0;font-size:11px;color:#A1A1AA;">
                VoicePost · Auto-generated draft notification
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

// ─── Shared Email Delivery (SMTP → Resend → console) ──────────────────────────

async function sendRawEmail({
  to,
  subject,
  html,
  logLabel,
  logExtra = "",
}: {
  to: string;
  subject: string;
  html: string;
  logLabel: string;
  logExtra?: string;
}) {
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
        port,
        secure,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
      });
      const info = await transporter.sendMail({ from: fromEmail, to, subject, html });
      console.log(`[${logLabel}] Email sent via SMTP to ${to} — MessageId: ${info.messageId}`);
      return { success: true, method: "smtp", message_id: info.messageId, recipient: to };
    } catch (smtpErr: any) {
      console.error(`[${logLabel}] SMTP failed, falling back to Resend:`, smtpErr.message);
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log(`\n=== 📧 ${logLabel} (Console Fallback) ===`);
    console.log(`To: ${to} | Subject: ${subject} ${logExtra}`);
    console.log("=".repeat(80) + "\n");
    return { success: true, method: "console_log", recipient: to };
  }

  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "VoicePost <noreply@resend.dev>";
  const { data: emailData, error: emailError } = await resend.emails.send({ from: fromEmail, to: [to], subject, html });

  if (emailError) {
    console.error(`[${logLabel}] Resend error:`, emailError.message);
    return { success: true, method: "console_log_fallback", error: emailError.message, recipient: to };
  }

  console.log(`[${logLabel}] Email sent to ${to} — ID: ${emailData?.id}`);
  return { success: true, method: "resend", email_id: emailData?.id, recipient: to };
}

// ─── Helper: lookup user email+name by post_id ────────────────────────────────

async function getUserForPost(post_id: string) {
  const db = getServiceSupabase();
  const { data: post } = await db.from("posts").select("user_id, post_content, hashtags").eq("id", post_id).single();
  if (!post?.user_id) return null;
  const { data: user } = await db.from("users").select("email, full_name").eq("id", post.user_id).single();
  return user ? { ...user, post_content: post.post_content, hashtags: post.hashtags || [] } : null;
}

// ─── Draft Ready Email ─────────────────────────────────────────────────────────

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
  const { data: post } = await db.from("posts").select("user_id").eq("id", post_id).single();

  let recipientEmail = "demo@voicepost.com";
  let recipientName = "there";

  if (post?.user_id) {
    const { data: user } = await db.from("users").select("email, full_name").eq("id", post.user_id).single();
    if (user) {
      recipientEmail = user.email || recipientEmail;
      recipientName = user.full_name || recipientName;
    }
  } else {
    const { data: users } = await db.from("users").select("email, full_name").limit(1);
    const fallbackUser = users?.[0];
    recipientEmail = fallbackUser?.email || recipientEmail;
    recipientName = fallbackUser?.full_name || recipientName;
  }

  const finalApprovalUrl = `${baseUrl}/posts/${post_id}/approval`;

  // Generate signed one-click action tokens (7-day expiry)
  const approveToken = createEmailActionToken(post_id, "approve");
  const rejectToken = createEmailActionToken(post_id, "reject");
  const approveUrl = `${baseUrl}/api/posts/${post_id}/email-action?token=${approveToken}&action=approve`;
  const rejectUrl = `${baseUrl}/api/posts/${post_id}/email-action?token=${rejectToken}&action=reject`;

  const htmlBody = buildEmailHtml({
    recipientName,
    postContent: post_content,
    hashtags,
    approvalUrl: finalApprovalUrl,
    approveUrl,
    rejectUrl,
  });
  const subject = "📝 Your LinkedIn Draft is Ready — Approve or Request Changes";

  return sendRawEmail({
    to: recipientEmail,
    subject,
    html: htmlBody,
    logLabel: "notify/draft",
    logExtra: `| Post: ${post_id}`,
  });
}

// ─── Post Approved / Published Email ──────────────────────────────────────────

function buildApprovedEmailHtml({
  recipientName,
  postContent,
  hashtags,
  linkedinUrl,
  scheduled,
  scheduledAt,
}: {
  recipientName: string;
  postContent: string;
  hashtags: string[];
  linkedinUrl?: string;
  scheduled?: boolean;
  scheduledAt?: string;
}): string {
  const firstName = recipientName.split(" ")[0] || "there";
  const hashtagPills = hashtags
    .map((tag) => `<span style="display:inline-block;background:#ECFDF5;color:#065F46;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin:3px 3px 0 0;">#${tag}</span>`)
    .join("");
  const safeContent = postContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");

  const statusBadge = scheduled
    ? `<div style="display:inline-block;background:#ECFDF5;color:#065F46;font-size:13px;font-weight:700;padding:8px 20px;border-radius:999px;margin-bottom:20px;">🗓 Scheduled${scheduledAt ? ` for ${new Date(scheduledAt).toLocaleString()}` : ""}</div>`
    : `<div style="display:inline-block;background:#ECFDF5;color:#065F46;font-size:13px;font-weight:700;padding:8px 20px;border-radius:999px;margin-bottom:20px;">✅ Published to LinkedIn</div>`;

  const ctaSection = linkedinUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;"><a href="${linkedinUrl}" style="display:inline-block;background:linear-gradient(135deg,#0A66C2,#0073B1);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:14px;">View on LinkedIn →</a></td></tr></table>`
    : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Post ${scheduled ? "Scheduled" : "Published"}</title></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding-bottom:24px;" align="center">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <div style="width:36px;height:36px;background:linear-gradient(135deg,#3B82F6,#8B5CF6);border-radius:10px;display:inline-block;"></div>
          <span style="font-size:20px;font-weight:800;color:#18181B;">VoicePost</span>
        </div>
      </td></tr>
      <tr><td style="background:#FFFFFF;border-radius:20px;padding:32px;border:1px solid #E4E4E7;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#18181B;">🎉 Great work, ${firstName}!</p>
        ${statusBadge}
        <p style="margin:0 0 20px;font-size:14px;color:#71717A;line-height:1.6;">Your post is live and reaching your audience on LinkedIn.</p>
        <hr style="border:none;border-top:1px solid #F4F4F5;margin:0 0 20px;"/>
        <div style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:14px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.8px;">Post Content</p>
          <p style="margin:12px 0 16px;font-size:14px;color:#27272A;line-height:1.7;">${safeContent}</p>
          ${hashtagPills ? `<div style="margin-top:12px;">${hashtagPills}</div>` : ""}
        </div>
        ${ctaSection}
        <p style="margin:0;font-size:12px;color:#A1A1AA;text-align:center;">Keep the momentum going — create your next post in VoicePost.</p>
      </td></tr>
      <tr><td style="padding:24px 0 0;" align="center">
        <p style="margin:0;font-size:11px;color:#A1A1AA;">VoicePost · Post status notification</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

// ─── Post Rejected Email ───────────────────────────────────────────────────────

function buildRejectedEmailHtml({
  recipientName,
  postContent,
  feedback,
  approvalUrl,
}: {
  recipientName: string;
  postContent: string;
  feedback?: string;
  approvalUrl: string;
}): string {
  const firstName = recipientName.split(" ")[0] || "there";
  const safeContent = postContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  const safeFeedback = feedback ? feedback.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Post Needs Changes</title></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding-bottom:24px;" align="center">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <div style="width:36px;height:36px;background:linear-gradient(135deg,#3B82F6,#8B5CF6);border-radius:10px;display:inline-block;"></div>
          <span style="font-size:20px;font-weight:800;color:#18181B;">VoicePost</span>
        </div>
      </td></tr>
      <tr><td style="background:#FFFFFF;border-radius:20px;padding:32px;border:1px solid #E4E4E7;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#18181B;">✏️ Your post needs changes, ${firstName}</p>
        <div style="display:inline-block;background:#FEF2F2;color:#991B1B;font-size:13px;font-weight:700;padding:8px 20px;border-radius:999px;margin-bottom:16px;">❌ Changes Requested</div>
        <p style="margin:0 0 20px;font-size:14px;color:#71717A;line-height:1.6;">The post was sent back for revision. Review the feedback below and regenerate.</p>
        <hr style="border:none;border-top:1px solid #F4F4F5;margin:0 0 20px;"/>
        ${safeFeedback ? `
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:16px 20px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.8px;">Feedback</p>
          <p style="margin:0;font-size:14px;color:#7F1D1D;line-height:1.6;">${safeFeedback}</p>
        </div>` : ""}
        <div style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:14px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.8px;">Original Draft</p>
          <p style="margin:12px 0 0;font-size:14px;color:#27272A;line-height:1.7;">${safeContent}</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
          <a href="${approvalUrl}" style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#8B5CF6);color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:14px;">Revise &amp; Resubmit →</a>
        </td></tr></table>
        <p style="margin:0;font-size:12px;color:#A1A1AA;text-align:center;">Use the "Request Changes" feature to tweak the content and regenerate.</p>
      </td></tr>
      <tr><td style="padding:24px 0 0;" align="center">
        <p style="margin:0;font-size:11px;color:#A1A1AA;">VoicePost · Post status notification</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

// ─── Send Status Email (approve or reject) ─────────────────────────────────────

export async function sendStatusEmail({
  post_id,
  action,
  feedback,
  scheduled_at,
  baseUrl,
}: {
  post_id: string;
  action: "approved" | "rejected" | "scheduled";
  feedback?: string;
  scheduled_at?: string;
  baseUrl: string;
}) {
  const db = getServiceSupabase();
  const { data: post } = await db.from("posts").select("user_id, post_content, hashtags").eq("id", post_id).single();

  if (!post?.user_id) {
    console.warn(`[notify/status] Could not find post ${post_id}`);
    return;
  }

  const { data: user } = await db.from("users").select("email, full_name").eq("id", post.user_id).single();
  if (!user?.email) {
    console.warn(`[notify/status] No email found for user of post ${post_id}`);
    return;
  }

  const approvalUrl = `${baseUrl}/posts/${post_id}/approval`;

  if (action === "rejected") {
    const html = buildRejectedEmailHtml({
      recipientName: user.full_name || "there",
      postContent: post.post_content || "",
      feedback,
      approvalUrl,
    });
    return sendRawEmail({
      to: user.email,
      subject: "✏️ Your LinkedIn Post Needs Changes",
      html,
      logLabel: "notify/rejected",
      logExtra: `| Post: ${post_id}`,
    });
  } else {
    const html = buildApprovedEmailHtml({
      recipientName: user.full_name || "there",
      postContent: post.post_content || "",
      hashtags: post.hashtags || [],
      scheduled: action === "scheduled",
      scheduledAt: scheduled_at,
    });
    const subject = action === "scheduled"
      ? "🗓 Your LinkedIn Post Has Been Scheduled"
      : "✅ Your LinkedIn Post Has Been Published!";
    return sendRawEmail({
      to: user.email,
      subject,
      html,
      logLabel: "notify/approved",
      logExtra: `| Post: ${post_id}`,
    });
  }
}
