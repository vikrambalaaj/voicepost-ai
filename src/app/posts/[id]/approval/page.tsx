"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import {
  ArrowLeft, Check, AlertTriangle, Plus, X, Clock, HelpCircle,
  History, Sparkles, Download, ChevronLeft, ChevronRight, Edit3, Loader2, Layout, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Slide {
  slideNumber: number;
  type: "cover" | "content" | "cta";
  title: string;
  body: string;
  emoji: string;
}

// ─── Canvas Helper Drawing Functions ────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  slideIndex: number,
  totalSlides: number,
  templateId: string,
  accentColor: string
) {
  const isCover = slide.type === "cover";
  const isCta = slide.type === "cta";

  if (templateId === "bold_impact") {
    // Background
    ctx.fillStyle = "#0F0F0F";
    ctx.fillRect(0, 0, 1080, 1080);

    // Top Accent Bar
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 1080, 20);

    // Slide counter
    ctx.fillStyle = accentColor;
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText(isCover ? "● ● ● ● ●" : `${slideIndex + 1} / ${totalSlides}`, 80, 100);

    // Emoji
    ctx.font = "80px system-ui, sans-serif";
    ctx.fillText(slide.emoji, 900, 120);

    // Title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "black 56px system-ui, sans-serif";
    const titleY = 450;
    const titleNextY = wrapText(ctx, slide.title, 80, titleY, 920, 75);

    // Body
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "normal 32px system-ui, sans-serif";
    wrapText(ctx, slide.body, 80, titleNextY + 30, 920, 48);

    // Brand bar (cover only)
    if (isCover) {
      ctx.strokeStyle = "#27272A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 950);
      ctx.lineTo(1000, 950);
      ctx.stroke();

      // Icon
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(100, 990, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText("V", 96, 996);

      ctx.fillStyle = "#71717A";
      ctx.font = "normal 24px system-ui, sans-serif";
      ctx.fillText("VoicePost · swipe to read →", 140, 998);
    }
  } else if (templateId === "minimal_clean") {
    // Background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, 1080, 1080);

    // Left Accent line
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 20, 1080);

    // Slide counter
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "bold 28px Georgia, serif";
    ctx.fillText(isCover ? "Swipe →" : `0${slideIndex + 1}`, 100, 120);

    // Emoji
    ctx.font = "80px Georgia, serif";
    ctx.fillText(slide.emoji, 900, 130);

    // Title
    ctx.fillStyle = accentColor;
    ctx.font = "bold 56px Georgia, serif";
    const titleY = 480;
    const titleNextY = wrapText(ctx, slide.title, 100, titleY, 880, 75);

    // Accent divider line
    ctx.fillStyle = accentColor;
    ctx.fillRect(100, titleNextY + 15, 120, 6);

    // Body
    ctx.fillStyle = "#3F3F46";
    ctx.font = "normal 32px Georgia, serif";
    wrapText(ctx, slide.body, 100, titleNextY + 70, 880, 50);

    if (isCover) {
      ctx.fillStyle = "#A1A1AA";
      ctx.font = "normal 24px Georgia, serif";
      ctx.fillText("A thread by VoicePost", 100, 980);
    }
  } else if (templateId === "gradient_flow") {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, accentColor);
    grad.addColorStop(1, "#0F0F0F");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Glow circle top right
    const glowGrad = ctx.createRadialGradient(980, 100, 0, 980, 100, 300);
    glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
    glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(980, 100, 300, 0, Math.PI * 2);
    ctx.fill();

    // Slide counter (rounded pill)
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    drawRoundedRect(ctx, 80, 80, 160, 50, 25);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText(isCover ? "New Post" : `${slideIndex + 1} / ${totalSlides}`, 115, 112);

    // Emoji
    ctx.font = "80px system-ui, sans-serif";
    ctx.fillText(slide.emoji, 900, 140);

    // Title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "black 56px system-ui, sans-serif";
    const titleY = 480;
    const titleNextY = wrapText(ctx, slide.title, 80, titleY, 920, 75);

    // Body
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "normal 32px system-ui, sans-serif";
    wrapText(ctx, slide.body, 80, titleNextY + 30, 920, 48);

    if (isCover) {
      // Draw page dots
      for (let d = 0; d < totalSlides; d++) {
        ctx.fillStyle = d === 0 ? "#FFFFFF" : "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(80 + d * 30, 980, d === 0 ? 10 : 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (templateId === "split_pro") {
    // Left panel (accent background)
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 432, 1080);

    // Right panel (white background)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(432, 0, 648, 1080);

    // Left panel content
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "black 64px system-ui, sans-serif";
    ctx.fillText(isCover ? "💡" : `0${slideIndex + 1}`, 80, 150);

    ctx.font = "120px system-ui, sans-serif";
    ctx.fillText(slide.emoji, 80, 650);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "normal 28px system-ui, sans-serif";
    ctx.fillText(`${totalSlides} slides`, 80, 980);

    // Right panel content
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, 500, 80, 150, 48, 24);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText(isCover ? "Swipe →" : isCta ? "Follow" : `Step ${slideIndex}`, 530, 111);

    ctx.fillStyle = "#18181B";
    ctx.font = "black 50px system-ui, sans-serif";
    const titleY = 480;
    const titleNextY = wrapText(ctx, slide.title, 500, titleY, 500, 70);

    ctx.fillStyle = "#71717A";
    ctx.font = "normal 30px system-ui, sans-serif";
    wrapText(ctx, slide.body, 500, titleNextY + 30, 500, 46);

    // Page indicators bottom right
    const dotCount = Math.min(totalSlides, 5);
    for (let d = 0; d < dotCount; d++) {
      ctx.fillStyle = d === slideIndex ? accentColor : "#E4E4E7";
      ctx.fillRect(500 + d * 90, 960, 80, 8);
    }
  } else {
    // frosted_card (default)
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, "#1E1B4B");
    grad.addColorStop(0.5, "#312E81");
    grad.addColorStop(1, "#1E1B4B");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Stars
    ctx.fillStyle = "#FFFFFF";
    for (let s = 0; s < 25; s++) {
      const starX = (100 + (s * 137) % 880);
      const starY = (100 + (s * 253) % 880);
      const opacity = 0.2 + (s % 4) * 0.2;
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.beginPath();
      ctx.arc(starX, starY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Card boundary
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.strokeStyle = `${accentColor}4D`;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 80, 80, 920, 920, 32);
    ctx.fill();
    ctx.stroke();

    // Counter pill
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, 120, 120, 160, 50, 25);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText(isCover ? "New" : `${slideIndex + 1} of ${totalSlides}`, 155, 152);

    // Emoji
    ctx.font = "80px system-ui, sans-serif";
    ctx.fillText(slide.emoji, 860, 170);

    // Title
    ctx.fillStyle = accentColor;
    ctx.font = "black 56px system-ui, sans-serif";
    const titleY = 480;
    const titleNextY = wrapText(ctx, slide.title, 130, titleY, 820, 75);

    // Body
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "normal 32px system-ui, sans-serif";
    wrapText(ctx, slide.body, 130, titleNextY + 30, 820, 48);
  }
}

// ─── Author Branding Strip ────────────────────────────────────────────────────
function AuthorStrip({
  name,
  picture,
  accentColor,
  dark = true,
  compact = false,
  linkedinUrl = "",
  isCta = false,
}: {
  name: string;
  picture?: string;
  accentColor: string;
  dark?: boolean;
  compact?: boolean;
  linkedinUrl?: string;
  isCta?: boolean;
}) {
  const displayName = name || "Your Name";
  return (
    <div
      className={`flex flex-col gap-1.5 ${compact ? "mt-2 pt-2" : "mt-3 pt-3"} border-t`}
      style={{ borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)" }}
    >
      <div className="flex items-center gap-2">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture}
            alt={displayName}
            className={`rounded-full object-cover flex-shrink-0 ${compact ? "w-5 h-5" : "w-8 h-8"}`}
          />
        ) : (
          <div
            className={`rounded-full flex items-center justify-center flex-shrink-0 ${compact ? "w-5 h-5" : "w-8 h-8"}`}
            style={{ background: accentColor }}
          >
            <span className={`text-white font-bold ${compact ? "text-[8px]" : "text-xs"}`}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold truncate ${compact ? "text-[8px]" : "text-xs"}`}
            style={{ color: dark ? "#e4e4e7" : "#18181b" }}
          >
            {displayName}
          </p>
          {!compact && (
            <p className="text-[10px] truncate" style={{ color: dark ? "#71717a" : "#a1a1aa" }}>
              LinkedIn · Follow for more
            </p>
          )}
        </div>
      </div>
      {/* Show LinkedIn URL on CTA slides when available */}
      {isCta && !compact && linkedinUrl && (
        <p
          className="text-[11px] font-mono truncate"
          style={{ color: dark ? "#60a5fa" : "#2563eb" }}
        >
          🔗 {linkedinUrl.replace("https://", "")}
        </p>
      )}
    </div>
  );
}

// ─── SlideCanvas React Component ──────────────────────────────────────────────

function SlideCanvasComponent({
  slide,
  templateId,
  accentColor,
  slideIndex,
  totalSlides,
  compact = false,
  showAuthor = true,
  authorName = "",
  authorPicture = "",
  authorLinkedinUrl = "",
}: {
  slide: Slide;
  templateId: string;
  accentColor: string;
  slideIndex: number;
  totalSlides: number;
  compact?: boolean;
  showAuthor?: boolean;
  authorName?: string;
  authorPicture?: string;
  authorLinkedinUrl?: string;
}) {
  const isCover = slide.type === "cover";
  const isCta = slide.type === "cta";
  const padding = compact ? "p-4" : "p-7";

  const getGradientStyle = () => {
    return `linear-gradient(135deg, ${accentColor} 0%, #0F0F0F 100%)`;
  };

  if (templateId === "bold_impact") {
    return (
      <div
        className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden`}
        style={{ background: "#0F0F0F", fontFamily: "system-ui, sans-serif" }}
      >
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accentColor }} />
        <div className="flex justify-between items-center mb-auto">
          <div className={`${compact ? "text-[9px]" : "text-xs"} font-bold uppercase tracking-widest`} style={{ color: accentColor }}>
            {isCover ? "●●●●●" : `${slideIndex + 1} / ${totalSlides}`}
          </div>
          {!compact && <div className="text-2xl">{slide.emoji}</div>}
        </div>
        <div className="mt-auto">
          {compact && <div className="text-xl mb-1">{slide.emoji}</div>}
          <h2
            className={`font-black leading-tight text-white ${compact ? "text-sm mb-1" : "text-2xl mb-3"}`}
            style={{ textShadow: `0 0 30px ${accentColor}40` }}
          >
            {slide.title}
          </h2>
          <p className={`text-zinc-400 leading-relaxed ${compact ? "text-[10px]" : "text-sm"}`}>
            {slide.body}
          </p>
        </div>
        {showAuthor && (
          <AuthorStrip name={authorName} picture={authorPicture} accentColor={accentColor} dark compact={compact} isCta={isCta} linkedinUrl={authorLinkedinUrl} />
        )}
      </div>
    );
  }

  if (templateId === "minimal_clean") {
    return (
      <div
        className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden bg-white`}
        style={{ fontFamily: "Georgia, serif" }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accentColor }} />
        <div className={`${compact ? "ml-3" : "ml-5"} flex flex-col h-full`}>
          <div className="flex justify-between items-start">
            <div className={`font-mono ${compact ? "text-[8px]" : "text-xs"} text-zinc-400 uppercase tracking-widest`}>
              {isCover ? "Swipe →" : `0${slideIndex + 1}`}
            </div>
            <span className={compact ? "text-lg" : "text-3xl"}>{slide.emoji}</span>
          </div>
          <div className="mt-auto">
            <h2
              className={`font-bold leading-tight ${compact ? "text-sm mb-1" : "text-2xl mb-4"}`}
              style={{ color: accentColor, fontFamily: "Georgia, serif" }}
            >
              {slide.title}
            </h2>
            <div className={`${compact ? "w-6 h-px mb-1" : "w-10 h-px mb-4"}`} style={{ background: accentColor }} />
            <p className={`text-zinc-600 leading-relaxed ${compact ? "text-[10px]" : "text-sm"}`} style={{ fontFamily: "Georgia, serif" }}>
              {slide.body}
            </p>
          </div>
          {showAuthor && (
            <AuthorStrip name={authorName} picture={authorPicture} accentColor={accentColor} dark={false} compact={compact} isCta={isCta} linkedinUrl={authorLinkedinUrl} />
          )}
        </div>
      </div>
    );
  }

  if (templateId === "gradient_flow") {
    return (
      <div
        className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden`}
        style={{ background: getGradientStyle(), fontFamily: "system-ui, sans-serif" }}
      >
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 blur-2xl"
          style={{ background: accentColor }}
        />
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div
              className={`${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} rounded-full font-bold text-white`}
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
            >
              {isCover ? "New Post" : `${slideIndex + 1}/${totalSlides}`}
            </div>
            <span className={compact ? "text-xl" : "text-3xl"}>{slide.emoji}</span>
          </div>
          <div className="mt-auto">
            <h2 className={`font-black text-white leading-tight ${compact ? "text-sm mb-1" : "text-2xl mb-3"}`}>
              {slide.title}
            </h2>
            <p className={`text-white/80 leading-relaxed ${compact ? "text-[10px]" : "text-sm"}`}>
              {slide.body}
            </p>
          </div>
          {showAuthor && (
            <AuthorStrip name={authorName} picture={authorPicture} accentColor={accentColor} dark compact={compact} isCta={isCta} linkedinUrl={authorLinkedinUrl} />
          )}
        </div>
      </div>
    );
  }

  if (templateId === "split_pro") {
    return (
      <div className="relative w-full aspect-square flex overflow-hidden bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          className={`flex flex-col justify-between ${compact ? "w-1/3 p-3" : "w-2/5 p-6"}`}
          style={{ background: accentColor }}
        >
          <div>
            <div className={`font-black text-white ${compact ? "text-base" : "text-2xl"}`}>
              {isCover ? "💡" : `0${slideIndex + 1}`}
            </div>
          </div>
          <div>
            {!compact && <div className="w-8 h-1 bg-white/50 mb-3 rounded-full" />}
            <span className={compact ? "text-lg" : "text-3xl"}>{slide.emoji}</span>
          </div>
          <div className={`text-white/60 ${compact ? "text-[8px]" : "text-xs"}`}>
            {totalSlides} slides
          </div>
        </div>
        <div className={`flex-1 flex flex-col justify-between ${compact ? "p-3" : "p-6"}`}>
          <div
            className={`${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} rounded-full font-bold w-fit`}
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {isCover ? "Swipe →" : isCta ? "Follow" : `Step ${slideIndex}`}
          </div>
          <div>
            <h2 className={`font-black leading-tight text-zinc-900 ${compact ? "text-[11px] mb-1" : "text-xl mb-3"}`}>
              {slide.title}
            </h2>
            <p className={`text-zinc-500 leading-relaxed ${compact ? "text-[9px]" : "text-xs"}`}>
              {slide.body}
            </p>
          </div>
          {showAuthor ? (
            <AuthorStrip name={authorName} picture={authorPicture} accentColor={accentColor} dark={false} compact={compact} isCta={isCta} linkedinUrl={authorLinkedinUrl} />
          ) : (
            <div className="flex gap-1">
              {[...Array(Math.min(totalSlides, compact ? 3 : 5))].map((_, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full flex-1"
                  style={{ background: i === slideIndex ? accentColor : "#E5E7EB" }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // frosted_card (default)
  return (
    <div
      className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E1B4B 100%)`,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div className="absolute inset-0 opacity-20">
        {[...Array(compact ? 6 : 15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${10 + (i * 37) % 80}%`,
              left: `${5 + (i * 53) % 90}%`,
              opacity: 0.4 + (i % 3) * 0.2,
            }}
          />
        ))}
      </div>
      <div
        className={`relative z-10 flex-1 flex flex-col rounded-2xl ${compact ? "p-3" : "p-5"}`}
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          border: `1px solid rgba(${parseInt(accentColor.slice(1, 3), 16)},${parseInt(accentColor.slice(3, 5), 16)},${parseInt(accentColor.slice(5, 7), 16)},0.3)`,
        }}
      >
        <div className="flex justify-between items-start">
          <div
            className={`rounded-full ${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} font-bold`}
            style={{ background: accentColor, color: "#fff" }}
          >
            {isCover ? "New" : `${slideIndex + 1} of ${totalSlides}`}
          </div>
          <span className={compact ? "text-xl" : "text-3xl"}>{slide.emoji}</span>
        </div>
        <div className="mt-auto">
          <h2
            className={`font-black leading-tight ${compact ? "text-sm mb-1" : "text-xl mb-3"}`}
            style={{ color: accentColor }}
          >
            {slide.title}
          </h2>
          <p className={`text-slate-300 leading-relaxed ${compact ? "text-[10px]" : "text-sm"}`}>
            {slide.body}
          </p>
          {showAuthor && (
            <AuthorStrip name={authorName} picture={authorPicture} accentColor={accentColor} dark compact={compact} isCta={isCta} linkedinUrl={authorLinkedinUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ApprovalPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [post, setPost] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [voice, setVoice] = useState<any>(null);
  const [linkedAccount, setLinkedAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit States
  const [postContent, setPostContent] = useState("");
  const [isEditingText, setIsEditingText] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState("");
  const [showAddHash, setShowAddHash] = useState(false);

  // Feedback State
  const [feedback, setFeedback] = useState("");
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Scheduling State
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  // Publish States
  const [publishing, setPublishing] = useState(false);

  // Carousel Specific States
  const [isCarousel, setIsCarousel] = useState(false);
  const [carouselData, setCarouselData] = useState<any>(null);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("bold_impact");
  const [accentColor, setAccentColor] = useState("#3B82F6");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showAuthor, setShowAuthor] = useState(true); // Author branding toggle for carousel slides

  // Load Data
  useEffect(() => {
    async function loadPostData() {
      try {
        const res = await fetch(`/api/posts/${id}`);
        const data = await res.json();
        if (data.success) {
          setPost(data.post);
          const rawContent = data.post.post_content || "";
          setPostContent(rawContent);
          setHashtags(data.post.hashtags || []);
          setRevisions(data.revisions || []);
          setImages(data.images || []);
          setVoice(data.voice || null);

          // Check if post is a carousel
          const cleanContent = rawContent.trim();
          if (cleanContent.startsWith("{") && cleanContent.endsWith("}")) {
            try {
              const parsed = JSON.parse(cleanContent);
              if (parsed.type === "carousel" || parsed.slides) {
                setIsCarousel(true);
                setCarouselData(parsed);
                setSelectedTemplate(parsed.templateId || "bold_impact");
                setAccentColor(parsed.accentColor || "#3B82F6");
              }
            } catch (e) {
              console.error("Failed to parse carousel JSON:", e);
            }
          }
        }

        // Load connected LinkedIn account
        const accRes = await fetch("/api/linkedin/scraping-status");
        const accData = await accRes.json();
        if (accData.status && accData.status !== "disconnected") {
          setLinkedAccount(accData);
        }
      } catch (err) {
        console.error("Failed to load approval package:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPostData();
  }, [id]);

  // Handle Hashtag management
  const handleRemoveHash = (idx: number) => {
    const updated = hashtags.filter((_, i) => i !== idx);
    setHashtags(updated);
    saveChanges(postContent, updated);
  };

  const handleAddHash = () => {
    if (newHashtag.trim()) {
      let clean = newHashtag.trim().replace(/^#/, "");
      const updated = [...hashtags, clean];
      setHashtags(updated);
      setNewHashtag("");
      setShowAddHash(false);
      saveChanges(postContent, updated);
    }
  };

  const saveChanges = async (content: string, tags: string[]) => {
    try {
      await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_content: content, hashtags: tags }),
      });
    } catch (e) {
      console.error("Failed to save changes:", e);
    }
  };

  // Carousel slide editing
  const startEditSlide = (idx: number) => {
    if (!carouselData) return;
    const s = carouselData.slides[idx];
    setEditTitle(s.title);
    setEditBody(s.body);
    setEditingSlide(idx);
  };

  const saveSlideEdit = async () => {
    if (editingSlide === null || !carouselData) return;
    const updatedCarousel = { ...carouselData };
    updatedCarousel.slides[editingSlide].title = editTitle;
    updatedCarousel.slides[editingSlide].body = editBody;
    
    setCarouselData(updatedCarousel);
    setEditingSlide(null);

    const serialized = JSON.stringify(updatedCarousel);
    setPostContent(serialized);
    await saveChanges(serialized, hashtags);
  };

  const changeTemplate = async (templateId: string) => {
    if (!carouselData) return;
    setSelectedTemplate(templateId);
    const updated = { ...carouselData, templateId };
    setCarouselData(updated);
    const serialized = JSON.stringify(updated);
    setPostContent(serialized);
    await saveChanges(serialized, hashtags);
  };

  const changeAccentColor = async (color: string) => {
    if (!carouselData) return;
    setAccentColor(color);
    const updated = { ...carouselData, accentColor: color };
    setCarouselData(updated);
    const serialized = JSON.stringify(updated);
    setPostContent(serialized);
    await saveChanges(serialized, hashtags);
  };

  // Helper to generate the PDF document using Canvas
  const generatePdfDocument = async () => {
    if (!carouselData) throw new Error("No carousel data available");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [1080, 1080],
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Could not get canvas context");

    const slides = carouselData.slides;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      
      ctx.clearRect(0, 0, 1080, 1080);
      drawSlideToCanvas(ctx, slide, i, slides.length, selectedTemplate, accentColor);

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (i > 0) {
        doc.addPage([1080, 1080], "portrait");
      }
      doc.addImage(imgData, "JPEG", 0, 0, 1080, 1080);
    }
    return doc;
  };

  // Generate and download PDF
  const downloadPdf = async () => {
    if (!carouselData) return;
    setDownloadingPdf(true);

    try {
      const doc = await generatePdfDocument();
      doc.save(`${(carouselData.title || "carousel").toLowerCase().replace(/[^a-z0-9]+/g, "_")}_carousel.pdf`);
    } catch (err: any) {
      alert("Failed to download PDF: " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Handle Approve & Publish
  const handlePublish = async () => {
    setPublishing(true);
    try {
      // 1. Enforce minimum hashtags before publishing
      const minHashtags = isCarousel ? 5 : 6;
      if (hashtags.length < minHashtags) {
        alert(`Please add at least ${minHashtags} hashtags before publishing. You currently have ${hashtags.length}.`);
        setPublishing(false);
        return;
      }

      // 2. Save changes first
      await saveChanges(postContent, hashtags);

      // 3. Schedule or Publish now
      if (scheduleMode === "schedule" && scheduledAt) {
        const approveRes = await fetch(`/api/posts/${id}/approve`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_at: scheduledAt }),
        });
        const approveData = await approveRes.json();
        if (approveData.success) {
          alert("Post scheduled successfully!");
          router.push("/dashboard");
        }
      } else {
        // Publish Now — always use "waterfall" (antigravity requires local Python env)
        const selectedBackend = localStorage.getItem("voicepost_ai_backend") || "waterfall";
        const safeBackend = selectedBackend === "antigravity" ? "waterfall" : selectedBackend;
        const bodyPayload: any = { backend: safeBackend };

        if (isCarousel) {
          const doc = await generatePdfDocument();
          bodyPayload.carousel_pdf = doc.output("datauristring");
        }

        const pubRes = await fetch(`/api/posts/${id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        const pubData = await pubRes.json();
        
        if (pubRes.status === 403 && pubData.limit_hit) {
          alert(`${pubData.title}: ${pubData.body}`);
          router.push("/pricing");
        } else if (pubData.success) {
          alert("Successfully published to LinkedIn!");
          router.push("/dashboard");
        } else if (pubData.pending_review) {
          alert(pubData.message);
          navigator.clipboard.writeText(pubData.post_content + "\n\n" + pubData.hashtags.map((h: string) => `#${h}`).join(" "));
          window.open("https://www.linkedin.com/", "_blank");
          router.push("/dashboard");
        } else {
          alert("Publish failed: " + (pubData.error || "Unknown error. Check server logs."));
        }
      }
    } catch (e: any) {
      console.error(e);
      alert("An error occurred: " + e.message);
    } finally {
      setPublishing(false);
    }
  };

  // Handle Request Changes / Regenerate
  const handleRegenerate = async () => {
    if (!feedback.trim()) {
      alert("Please enter what needs to change.");
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/content/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: id, feedback }),
      });
      const data = await res.json();
      if (data.success) {
        setPostContent(data.approval_package.post_content);
        setHashtags(data.approval_package.hashtags);
        setFeedback("");
        setShowFeedbackInput(false);
        // Refresh revisions
        const revRes = await fetch(`/api/posts/${id}`);
        const revData = await revRes.json();
        if (revData.success) {
          setRevisions(revData.revisions);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <IosShell>
        <div className="flex items-center justify-center min-h-[50vh] text-sm text-zinc-400">
          Loading Approval Package...
        </div>
      </IosShell>
    );
  }

  const activeImage = images.find((img) => img.is_selected) || images[0];
  const lastRevision = revisions[0] || {};

  return (
    <IosShell>
      <div className="pt-6 px-4">
        {/* iOS Nav Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="ios-back-btn">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <span className="font-semibold text-zinc-900 dark:text-white text-base">Approval Package</span>
          <div className="w-12" />
        </div>

        {/* AI Model Badge Info */}
        {lastRevision.provider_used && (
          <div className="ios-card bg-zinc-100 dark:bg-zinc-800/40 p-3 flex justify-between items-center text-xs text-zinc-500 font-medium mb-4">
            <span>Powered by {lastRevision.provider_used} ({lastRevision.model_used})</span>
            <span>Latency: {((lastRevision.latency_ms || 1000) / 1000).toFixed(1)}s</span>
          </div>
        )}

        {/* Agent Chain of Thought */}
        {post?.agent_thoughts && (
          <div className="ios-card bg-purple-500/5 border border-purple-500/20 p-4 mb-4 select-text">
            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
              <Sparkles className="w-3.5 h-3.5" /> Agent Chain-of-Thought Logs
            </h4>
            <div className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
              {post.agent_thoughts}
            </div>
          </div>
        )}

        {isCarousel && carouselData ? (
          /* CAROUSEL PREVIEW VIEW */
          <div className="space-y-6">
            <div className="ios-section-label">Carousel Preview & Style</div>

            {/* Canvas Slide Preview */}
            <div className="relative">
              <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden shadow-2xl">
                <SlideCanvasComponent
                  slide={carouselData.slides[previewSlide]}
                  templateId={selectedTemplate}
                  accentColor={accentColor}
                  slideIndex={previewSlide}
                  totalSlides={carouselData.slides.length}
                  showAuthor={showAuthor}
                  authorName={linkedAccount?.profile_name || ""}
                  authorPicture={linkedAccount?.profile_picture_url || ""}
                  authorLinkedinUrl={linkedAccount?.linkedin_profile_url || ""}
                />
              </div>

              {/* Edit overlay button */}
              <button
                onClick={() => startEditSlide(previewSlide)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 border-none cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              {/* Nav arrows */}
              {previewSlide > 0 && (
                <button
                  onClick={() => setPreviewSlide(previewSlide - 1)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center active:scale-95 transition-transform border-none cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-350" />
                </button>
              )}
              {previewSlide < carouselData.slides.length - 1 && (
                <button
                  onClick={() => setPreviewSlide(previewSlide + 1)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center active:scale-95 transition-transform border-none cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5 text-zinc-700 dark:text-zinc-350" />
                </button>
              )}
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-1.5">
              {carouselData.slides.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setPreviewSlide(i)}
                  className="rounded-full transition-all border-none cursor-pointer"
                  style={{
                    width: i === previewSlide ? 20 : 6,
                    height: 6,
                    background: i === previewSlide ? accentColor : "#D1D5DB",
                  }}
                />
              ))}
            </div>

            {/* Template & Color Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ios-card p-4 space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Layout className="w-3.5 h-3.5" /> Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => changeTemplate(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none"
                >
                  <option value="bold_impact">Bold Impact (Dark)</option>
                  <option value="minimal_clean">Minimal Clean (Light)</option>
                  <option value="gradient_flow">Gradient Flow (Colorful)</option>
                  <option value="split_pro">Split Pro (Corporate)</option>
                  <option value="frosted_card">Frosted Card (Glassmorphism)</option>
                </select>
              </div>

              <div className="ios-card p-4 space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => changeAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                  />
                  <code className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                    {accentColor.toUpperCase()}
                  </code>
                </div>
              </div>
            </div>

            {/* Author Branding Toggle */}
            <div className="ios-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {linkedAccount?.profile_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={linkedAccount.profile_picture_url}
                      alt={linkedAccount.profile_name || "Author"}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2"
                      style={{ ringColor: accentColor } as any}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                      style={{ background: accentColor }}
                    >
                      {(linkedAccount?.profile_name || "A").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-white">
                      {linkedAccount?.profile_name || "Not connected"}
                    </p>
                    {linkedAccount?.linkedin_profile_url && (
                      <a
                        href={linkedAccount.linkedin_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate block max-w-[180px]"
                      >
                        {linkedAccount.linkedin_profile_url.replace("https://www.linkedin.com/in/", "linkedin.com/in/")}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Show on slides</label>
                  <button
                    onClick={() => setShowAuthor((v) => !v)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 border-none cursor-pointer ${showAuthor ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                    aria-label="Toggle author branding"
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                      style={{ transform: showAuthor ? "translateX(24px)" : "translateX(0)" }}
                    />
                  </button>
                </div>
              </div>
              {linkedAccount?.linkedin_profile_url && (
                <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed">
                  💡 Your LinkedIn URL will appear on the last (CTA) slide so readers can follow you.
                </p>
              )}
            </div>

            {/* Editor Box */}
            {editingSlide !== null && editingSlide === previewSlide && (
              <div className="ios-card p-4 border-2" style={{ borderColor: accentColor }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: accentColor }}>
                  Editing Slide {editingSlide + 1}
                </p>
                <div className="mb-3">
                  <label className="text-xs text-zinc-500 font-semibold mb-1 block">Headline</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:ring-1"
                    style={{ borderColor: accentColor } as any}
                  />
                </div>
                <div className="mb-4">
                  <label className="text-xs text-zinc-500 font-semibold mb-1 block">Body text</label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 outline-none resize-none leading-relaxed"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingSlide(null)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSlideEdit}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 border-none cursor-pointer"
                    style={{ background: accentColor }}
                  >
                    <Check className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            )}

            {/* Download PDF button */}
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md border-none cursor-pointer transition-colors"
            >
              {downloadingPdf ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
              ) : (
                <><Download className="w-4 h-4" /> Download Carousel PDF</>
              )}
            </button>
          </div>
        ) : (
          /* STANDARD TEXT/IMAGE PREVIEW VIEW */
          <>
            <div className="ios-section-label flex justify-between items-center px-1 select-none">
              <span>LinkedIn Layout Preview</span>
              {!isEditingText && (
                <button
                  onClick={() => setIsEditingText(true)}
                  className="text-xs text-blue-500 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Post
                </button>
              )}
            </div>
            <div className="ios-card bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-4 shadow-sm select-text">
              <div className="flex gap-3 mb-3">
                <img
                  src={linkedAccount?.profile_picture_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                  alt="Profile"
                  className="w-11 h-11 rounded-full object-cover border border-zinc-200"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                    {linkedAccount?.profile_name || "John Doe"}
                  </h4>
                  <p className="text-xs text-zinc-500 truncate">
                    {linkedAccount?.profile_headline || "Tech Founder & AI Creator"}
                  </p>
                  <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                    Just now • 🌐
                  </p>
                </div>
              </div>

              {isEditingText ? (
                <div className="space-y-3 mb-3">
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="w-full text-sm text-zinc-850 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-blue-500 resize-y leading-relaxed font-sans min-h-[180px]"
                    placeholder="Write your post here..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPostContent(post?.post_content || "");
                        setIsEditingText(false);
                      }}
                      className="flex-1 py-2 rounded-xl font-semibold text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-none cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await saveChanges(postContent, hashtags);
                        setIsEditingText(false);
                      }}
                      className="flex-1 py-2 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 border-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap mb-3 select-text font-sans">
                  {postContent || "(Empty Post)"}
                </div>
              )}

              <div className="text-blue-600 dark:text-blue-400 text-sm font-semibold mb-3 flex flex-wrap gap-1">
                {hashtags.map((tag) => `#${tag} `)}
              </div>

              {activeImage && (
                <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-video mb-3 bg-zinc-100 flex items-center justify-center">
                  {activeImage.url.startsWith("data:video/") || activeImage.url.match(/\.(mp4|webm|ogg|mov|avi)($|\?)/i) ? (
                    <video src={activeImage.url} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={activeImage.url} alt="Post asset" className="w-full h-full object-cover" />
                  )}
                </div>
              )}

              <div className="flex justify-around border-t dark:border-zinc-800 pt-3 text-xs text-zinc-500 font-bold select-none">
                <span>👍 Like</span>
                <span>💬 Comment</span>
                <span>🔁 Repost</span>
                <span>✉️ Send</span>
              </div>
            </div>
          </>
        )}

        {/* Style Match & Score */}
        <div className="ios-section-label">Style Metrics</div>
        <div className="ios-card p-4 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Writing DNA Match</span>
          <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-bold rounded-full text-xs px-2.5 py-0.5">
            {post?.style_match_score || 8}/10 Match
          </Badge>
        </div>

        {/* Hashtags Editor */}
        <div className="ios-section-label">Manage Hashtags</div>
        <div className="ios-card p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {hashtags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50"
              >
                #{tag}
                <button onClick={() => handleRemoveHash(idx)} className="text-zinc-400 hover:text-zinc-650 bg-transparent border-none cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <button
              onClick={() => setShowAddHash(!showAddHash)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-500 hover:text-zinc-700 bg-transparent cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add tag
            </button>
          </div>

          {showAddHash && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                placeholder="marketing"
                className="flex-1 text-xs p-2.5 rounded-xl border bg-transparent focus:outline-none"
              />
              <Button onClick={handleAddHash} className="rounded-xl px-4 text-xs h-9 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-white border-none cursor-pointer">
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Scheduling Options */}
        <div className="ios-section-label">Scheduling</div>
        <div className="ios-card p-4">
          <div className="ios-segment mb-4">
            <button
              onClick={() => setScheduleMode("now")}
              className={`ios-segment-btn ${scheduleMode === "now" ? "active" : ""}`}
            >
              Post now
            </button>
            <button
              onClick={() => setScheduleMode("schedule")}
              className={`ios-segment-btn ${scheduleMode === "schedule" ? "active" : ""}`}
            >
              Schedule
            </button>
          </div>

          {scheduleMode === "schedule" && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Select Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full p-3 rounded-xl border bg-transparent text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="py-4 px-4 md:px-0">
          {showFeedbackInput ? (
            <div className="ios-card p-4 space-y-3 bg-red-50/20 dark:bg-red-950/10 border border-red-500/20 !mx-0">
              <label className="text-xs font-bold text-red-500 dark:text-red-400 uppercase">What needs to change?</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Example: Make it shorter. Make the opener more interesting. Add bullet points..."
                className="w-full h-24 p-3 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-bold border-none cursor-pointer text-xs"
                >
                  {regenerating ? "Regenerating..." : "Submit feedback"}
                </button>
                <Button
                  onClick={() => setShowFeedbackInput(false)}
                  variant="outline"
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row-reverse md:justify-start md:gap-4">
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="w-[calc(100%-32px)] md:w-auto md:px-8 mx-4 md:mx-0 my-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-850 disabled:text-zinc-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md border-none text-[17px] font-semibold cursor-pointer transition-all duration-200"
              >
                {publishing ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {scheduleMode === "schedule" ? "Approve & Schedule" : "Approve & Publish"}
                  </>
                )}
              </button>

              {!isCarousel && (
                <button
                  onClick={() => setShowFeedbackInput(true)}
                  className="w-[calc(100%-32px)] md:w-auto md:px-8 mx-4 md:mx-0 my-2 bg-transparent hover:bg-red-500/10 text-red-500 hover:text-red-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 border border-red-500/30 text-[17px] font-semibold cursor-pointer transition-all duration-200"
                >
                  Request changes
                </button>
              )}
            </div>
          )}
        </div>

        {/* Changelog Accordion */}
        <div className="ios-section-label">Revision History</div>
        <div className="ios-card p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50 mb-8">
          {revisions.length === 0 ? (
            <p className="text-xs text-zinc-500">No revisions logged yet.</p>
          ) : (
            revisions.map((rev, idx) => (
              <div key={rev.id} className="border-l-2 border-blue-500 pl-3 space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>Revision #{rev.revision_number}</span>
                  <span className="text-zinc-400 font-normal">
                    {new Date(rev.created_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {rev.feedback_given && (
                  <p className="text-xs text-zinc-400 font-medium italic">
                    Feedback: &ldquo;{rev.feedback_given}&rdquo;
                  </p>
                )}
                {rev.changes_made && rev.changes_made.length > 0 && (
                  <p className="text-[10px] text-zinc-500">
                    Changes: {rev.changes_made.join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </IosShell>
  );
}
