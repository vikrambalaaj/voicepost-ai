"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EmailActionResultPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { id } = params;

  const result = searchParams.get("result") as "approved" | "rejected" | "error" | null;
  const msg = searchParams.get("msg") || "";

  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (result === "error") return; // don't auto-redirect on error
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.push(`/posts/${id}/approval`);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [id, result, router]);

  const config = {
    approved: {
      emoji: "✅",
      color: "#10B981",
      bg: "#ECFDF5",
      border: "#6EE7B7",
      title: "Post Approved!",
      body: "Your LinkedIn post has been approved and is queued for publishing. Head to the approval page to publish it now or schedule it.",
      badge: "Approved",
      badgeBg: "#D1FAE5",
      badgeColor: "#065F46",
    },
    rejected: {
      emoji: "❌",
      color: "#EF4444",
      bg: "#FEF2F2",
      border: "#FCA5A5",
      title: "Post Rejected",
      body: "The post has been marked for revision. You can open the approval page to request changes, edit the content, and regenerate.",
      badge: "Needs Changes",
      badgeBg: "#FEE2E2",
      badgeColor: "#991B1B",
    },
    error: {
      emoji: "⚠️",
      color: "#F59E0B",
      bg: "#FFFBEB",
      border: "#FCD34D",
      title: "Something went wrong",
      body: msg || "The link may have expired or is invalid. Please open the approval page directly.",
      badge: "Error",
      badgeBg: "#FEF3C7",
      badgeColor: "#92400E",
    },
  };

  const c = config[result || "error"];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #F4F4F5 0%, #E4E4E7 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "24px",
          padding: "48px 40px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          border: `1px solid ${c.border}`,
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              borderRadius: "10px",
            }}
          />
          <span style={{ fontSize: "20px", fontWeight: 800, color: "#18181B", letterSpacing: "-0.5px" }}>
            VoicePost
          </span>
        </div>

        {/* Icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: c.bg,
            border: `2px solid ${c.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            margin: "0 auto 24px",
          }}
        >
          {c.emoji}
        </div>

        {/* Badge */}
        <div
          style={{
            display: "inline-block",
            background: c.badgeBg,
            color: c.badgeColor,
            fontSize: "12px",
            fontWeight: 700,
            padding: "4px 16px",
            borderRadius: "999px",
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {c.badge}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#18181B",
            margin: "0 0 12px",
            letterSpacing: "-0.5px",
          }}
        >
          {c.title}
        </h1>

        {/* Body */}
        <p
          style={{
            fontSize: "15px",
            color: "#71717A",
            lineHeight: 1.6,
            margin: "0 0 32px",
          }}
        >
          {c.body}
        </p>

        {/* Countdown & CTA */}
        {result !== "error" && (
          <p style={{ fontSize: "13px", color: "#A1A1AA", marginBottom: "16px" }}>
            Redirecting to approval page in <strong style={{ color: "#18181B" }}>{countdown}s</strong>...
          </p>
        )}

        <button
          onClick={() => router.push(`/posts/${id}/approval`)}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 24px",
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            color: "#FFFFFF",
            fontSize: "15px",
            fontWeight: 700,
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.2px",
          }}
        >
          Open Approval Page →
        </button>

        {result !== "error" && (
          <button
            onClick={() => router.push("/posts")}
            style={{
              display: "block",
              width: "100%",
              padding: "14px 24px",
              background: "transparent",
              color: "#71717A",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "14px",
              border: "1px solid #E4E4E7",
              cursor: "pointer",
              marginTop: "12px",
            }}
          >
            Back to All Posts
          </button>
        )}
      </div>
    </div>
  );
}
