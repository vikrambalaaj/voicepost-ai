"use client";

import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import {
  ChevronLeft, ChevronRight, Sparkles, Palette, Layout,
  Type, Check, Loader2, Download, Send, RefreshCw, Plus, Minus, Edit3, X
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Slide {
  slideNumber: number;
  type: "cover" | "content" | "cta";
  title: string;
  body: string;
  emoji: string;
}

interface CarouselData {
  title: string;
  slides: Slide[];
  suggestedHashtags: string[];
}

// ─── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "bold_impact",
    name: "Bold Impact",
    description: "Dark, punchy, high contrast",
    preview: { bg: "#0F0F0F", accent: "#3B82F6", text: "#FFFFFF", font: "sans" },
    tags: ["Dark", "Modern"],
  },
  {
    id: "minimal_clean",
    name: "Minimal Clean",
    description: "Light, elegant, spacious",
    preview: { bg: "#FAFAFA", accent: "#18181B", text: "#18181B", font: "serif" },
    tags: ["Light", "Premium"],
  },
  {
    id: "gradient_flow",
    name: "Gradient Flow",
    description: "Vibrant gradient backgrounds",
    preview: { bg: "gradient", accent: "#7C3AED", text: "#FFFFFF", font: "sans" },
    tags: ["Colorful", "Bold"],
  },
  {
    id: "split_pro",
    name: "Split Pro",
    description: "Corporate split layout",
    preview: { bg: "#FFFFFF", accent: "#0EA5E9", text: "#0F172A", font: "sans" },
    tags: ["Pro", "B2B"],
  },
  {
    id: "frosted_card",
    name: "Frosted Card",
    description: "Glassmorphism style",
    preview: { bg: "#1E1B4B", accent: "#A78BFA", text: "#F1F5F9", font: "sans" },
    tags: ["Trendy", "Glass"],
  },
];

const COLOR_PALETTES = [
  { name: "Electric Blue", accent: "#3B82F6", dark: "#1D4ED8" },
  { name: "Violet", accent: "#7C3AED", dark: "#5B21B6" },
  { name: "Emerald", accent: "#10B981", dark: "#059669" },
  { name: "Rose", accent: "#F43F5E", dark: "#BE123C" },
  { name: "Amber", accent: "#F59E0B", dark: "#D97706" },
  { name: "Cyan", accent: "#06B6D4", dark: "#0891B2" },
  { name: "Orange", accent: "#F97316", dark: "#EA580C" },
  { name: "Slate", accent: "#64748B", dark: "#475569" },
];

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
  accentColor: string,
  bgImgElement?: HTMLImageElement
) {
  const isCover = slide.type === "cover";
  const isCta = slide.type === "cta";

  if (templateId === "bold_impact") {
    // Background
    if (bgImgElement) {
      ctx.drawImage(bgImgElement, 0, 0, 1080, 1080);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, 1080, 1080);
    } else {
      ctx.fillStyle = "#0F0F0F";
      ctx.fillRect(0, 0, 1080, 1080);
    }

    // Top Accent Bar
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 1080, 20);

    // Slide counter
    ctx.fillStyle = accentColor;
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText(isCover ? "● ● ● ● ●" : `${slideIndex + 1} / ${totalSlides}`, 80, 100);

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
    if (bgImgElement) {
      ctx.drawImage(bgImgElement, 0, 0, 1080, 1080);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillRect(0, 0, 1080, 1080);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 1080, 1080);
    }

    // Left Accent line
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 20, 1080);

    // Slide counter
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "bold 28px Georgia, serif";
    ctx.fillText(isCover ? "Swipe →" : `0${slideIndex + 1}`, 100, 120);

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
    if (bgImgElement) {
      ctx.drawImage(bgImgElement, 0, 0, 1080, 1080);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, 1080, 1080);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, accentColor);
      grad.addColorStop(1, "#0F0F0F");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1080);
    }

    // Glow circle top right - only if no bg image
    if (!bgImgElement) {
      const glowGrad = ctx.createRadialGradient(980, 100, 0, 980, 100, 300);
      glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
      glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(980, 100, 300, 0, Math.PI * 2);
      ctx.fill();
    }

    // Slide counter (rounded pill)
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    drawRoundedRect(ctx, 80, 80, 160, 50, 25);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText(isCover ? "New Post" : `${slideIndex + 1} / ${totalSlides}`, 115, 112);

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
    if (bgImgElement) {
      ctx.drawImage(bgImgElement, 0, 0, 1080, 1080);
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0, 0, 432, 1080);
      ctx.globalAlpha = 1.0;
      // Right panel overlay
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillRect(432, 0, 648, 1080);
    } else {
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 0, 432, 1080);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(432, 0, 648, 1080);
    }

    // Left panel content
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "black 64px system-ui, sans-serif";
    ctx.fillText(isCover ? "💡" : `0${slideIndex + 1}`, 80, 150);

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
    if (bgImgElement) {
      ctx.drawImage(bgImgElement, 0, 0, 1080, 1080);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, 1080, 1080);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, "#1E1B4B");
      grad.addColorStop(0.5, "#312E81");
      grad.addColorStop(1, "#1E1B4B");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1080);
    }

    // Stars
    if (!bgImgElement) {
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
    }

    // Card boundary
    ctx.fillStyle = bgImgElement ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)";
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

// ─── Slide Canvas React Component ───────────────────────────────────────────

function SlideCanvas({
  slide,
  templateId,
  accentColor,
  slideIndex,
  totalSlides,
  compact = false,
  backgroundImage,
}: {
  slide: Slide;
  templateId: string;
  accentColor: string;
  slideIndex: number;
  totalSlides: number;
  compact?: boolean;
  backgroundImage?: string;
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
        style={{
          background: backgroundImage ? `url(${backgroundImage}) center/cover no-repeat` : "#0F0F0F",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        {backgroundImage && <div className="absolute inset-0 bg-black/45 z-0" />}
        <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ background: accentColor }} />
        <div className="relative z-10 flex justify-between items-center mb-auto">
          <div className={`${compact ? "text-[9px]" : "text-xs"} font-bold uppercase tracking-widest`} style={{ color: accentColor }}>
            {isCover ? "●●●●●" : `${slideIndex + 1} / ${totalSlides}`}
          </div>
        </div>
        <div className="relative z-10 mt-auto">
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
        {isCover && (
          <div className={`relative z-10 mt-3 flex items-center gap-2 ${compact ? "pt-2" : "pt-4"} border-t border-zinc-800`}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accentColor }}>
              <span className="text-white text-[8px] font-bold">V</span>
            </div>
            {!compact && <span className="text-zinc-500 text-xs">VoicePost · swipe to read →</span>}
          </div>
        )}
      </div>
    );
  }

  if (templateId === "minimal_clean") {
    return (
      <div
        className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden`}
        style={{
          background: backgroundImage ? `url(${backgroundImage}) center/cover no-repeat` : "white",
          fontFamily: "Georgia, serif"
        }}
      >
        {backgroundImage && <div className="absolute inset-0 bg-white/85 z-0" />}
        <div className="absolute left-0 top-0 bottom-0 w-1 z-10" style={{ background: accentColor }} />
        <div className={`relative z-10 ${compact ? "ml-3" : "ml-5"} flex flex-col h-full`}>
          <div className="flex justify-between items-start">
            <div className={`font-mono ${compact ? "text-[8px]" : "text-xs"} text-zinc-400 uppercase tracking-widest`}>
              {isCover ? "Swipe →" : `0${slideIndex + 1}`}
            </div>
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
          {isCover && (
            <div className={`${compact ? "mt-2 text-[8px]" : "mt-6 text-xs"} text-zinc-400`}>
              A thread by VoicePost
            </div>
          )}
        </div>
      </div>
    );
  }

  if (templateId === "gradient_flow") {
    return (
      <div
        className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden`}
        style={{
          background: backgroundImage ? `url(${backgroundImage}) center/cover no-repeat` : getGradientStyle(),
          fontFamily: "system-ui, sans-serif"
        }}
      >
        {backgroundImage && <div className="absolute inset-0 bg-black/50 z-0" />}
        {!backgroundImage && (
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 blur-2xl"
            style={{ background: accentColor }}
          />
        )}
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div
              className={`${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} rounded-full font-bold text-white`}
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
            >
              {isCover ? "New Post" : `${slideIndex + 1}/${totalSlides}`}
            </div>
          </div>
          <div className="mt-auto">
            <h2 className={`font-black text-white leading-tight ${compact ? "text-sm mb-1" : "text-2xl mb-3"}`}>
              {slide.title}
            </h2>
            <p className={`text-white/80 leading-relaxed ${compact ? "text-[10px]" : "text-sm"}`}>
              {slide.body}
            </p>
          </div>
          {!compact && isCover && (
            <div className="mt-4 flex items-center gap-2">
              {[...Array(totalSlides)].map((_, i) => (
                <div key={i} className={`rounded-full ${i === 0 ? "w-6 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (templateId === "split_pro") {
    return (
      <div className="relative w-full aspect-square flex overflow-hidden bg-white" style={{ fontFamily: "system-ui, sans-serif" }}>
        {backgroundImage && (
          <div
            className="absolute inset-0 z-0"
            style={{ background: `url(${backgroundImage}) center/cover no-repeat` }}
          />
        )}
        <div
          className={`relative z-10 flex flex-col justify-between ${compact ? "w-1/3 p-3" : "w-2/5 p-6"}`}
          style={{ background: backgroundImage ? `${accentColor}CC` : accentColor }}
        >
          <div>
            <div className={`font-black text-white ${compact ? "text-base" : "text-2xl"}`}>
              {isCover ? "💡" : `0${slideIndex + 1}`}
            </div>
          </div>
          <div className={`text-white/60 ${compact ? "text-[8px]" : "text-xs"}`}>
            {totalSlides} slides
          </div>
        </div>
        <div
          className={`relative z-10 flex-1 flex flex-col justify-between ${compact ? "p-3" : "p-6"}`}
          style={{ background: backgroundImage ? "rgba(255,255,255,0.85)" : undefined }}
        >
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
          <div className="flex gap-1">
            {[...Array(Math.min(totalSlides, compact ? 3 : 5))].map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full flex-1"
                style={{ background: i === slideIndex ? accentColor : "#E5E7EB" }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // frosted_card (default)
  return (
    <div
      className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden`}
      style={{
        background: backgroundImage ? `url(${backgroundImage}) center/cover no-repeat` : `linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E1B4B 100%)`,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {!backgroundImage && (
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
      )}
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
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function CarouselBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");

  // Step: 1=topic, 2=template+colors, 3=generating, 4=edit+preview, 5=publish
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [selectedTemplate, setSelectedTemplate] = useState("bold_impact");
  const [accentColor, setAccentColor] = useState("#3B82F6");
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [carouselData, setCarouselData] = useState<any>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(undefined);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSlideImage, setEditSlideImage] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (queryId) {
      const loadPost = async () => {
        try {
          const res = await fetch(`/api/posts/${queryId}`);
          const data = await res.json();
          if (data.success && data.post) {
            const post = data.post;
            setPostId(post.id);
            setHashtags(post.hashtags || []);
            
            try {
              const parsed = JSON.parse(post.post_content);
              if (parsed.type === "carousel") {
                setCarouselData({
                  title: parsed.title,
                  slides: parsed.slides,
                  suggestedHashtags: post.hashtags || [],
                  backgroundImage: parsed.backgroundImage || undefined,
                });
                if (parsed.backgroundImage) {
                  setBackgroundImage(parsed.backgroundImage);
                }
                setSelectedTemplate(parsed.templateId || "bold_impact");
                setAccentColor(parsed.accentColor || "#3B82F6");
                setStep(4);
              }
            } catch (err) {
              console.error("Failed to parse carousel json content:", err);
            }
          }
        } catch (err) {
          console.error("Failed to load carousel post:", err);
        }
      };
      loadPost();
    }
  }, [queryId]);

  // ── Save to Supabase Helper ──
  const savePostToSupabase = async (contentStr: string, tags: string[], status = "pending_approval") => {
    try {
      if (postId) {
        // Update
        await fetch(`/api/posts/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            post_content: contentStr,
            hashtags: tags,
            status,
          }),
        });
      } else {
        // Create
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            post_content: contentStr,
            hashtags: tags,
            style_type: "expert",
            style_id: "lara_acosta",
            status,
          }),
        });
        const data = await res.json();
        if (data.success && data.post) {
          setPostId(data.post.id);
        }
      }
    } catch (err) {
      console.error("Failed to sync carousel to DB:", err);
    }
  };

  // ── Generate slides ──
  const generateSlides = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setStep(3);
    setGeneratingStatus("Crafting slide content...");

    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, slideCount }),
      });

      const data = await res.json();
      if (!res.ok || !data.carousel) throw new Error(data.error || "Generation failed");

      setCarouselData(data.carousel);
      const tags = data.carousel.suggestedHashtags || [];
      setHashtags(tags);
      setPreviewSlide(0);

      // Save as draft in Supabase
      setGeneratingStatus("Saving carousel draft...");
      const serialized = JSON.stringify({
        type: "carousel",
        title: data.carousel.title,
        slides: data.carousel.slides,
        templateId: selectedTemplate,
        accentColor: accentColor,
        backgroundImage: backgroundImage,
      });
      await savePostToSupabase(serialized, tags, "pending_approval");

      setStep(4);
    } catch (err: any) {
      alert("Generation failed: " + err.message);
      setStep(2);
    } finally {
      setGenerating(false);
      setGeneratingStatus("");
    }
  };

  const startEdit = (idx: number) => {
    if (!carouselData) return;
    const s = carouselData.slides[idx];
    setEditTitle(s.title);
    setEditBody(s.body);
    setEditSlideImage(s.image || "");
    setEditingSlide(idx);
  };

  const saveEdit = async () => {
    if (editingSlide === null || !carouselData) return;
    const updated = { ...carouselData };
    updated.slides[editingSlide].title = editTitle;
    updated.slides[editingSlide].body = editBody;
    updated.slides[editingSlide].image = editSlideImage || undefined;
    setCarouselData(updated);
    setEditingSlide(null);

    // Save update to Supabase
    const serialized = JSON.stringify({
      type: "carousel",
      title: updated.title,
      slides: updated.slides,
      templateId: selectedTemplate,
      accentColor: accentColor,
      backgroundImage: updated.backgroundImage || backgroundImage,
    });
    await savePostToSupabase(serialized, hashtags, "pending_approval");
  };

  const handleTemplateSelect = async (tId: string) => {
    setSelectedTemplate(tId);
    if (carouselData) {
      const serialized = JSON.stringify({
        type: "carousel",
        title: carouselData.title,
        slides: carouselData.slides,
        templateId: tId,
        accentColor: accentColor,
        backgroundImage: carouselData.backgroundImage || backgroundImage,
      });
      await savePostToSupabase(serialized, hashtags, "pending_approval");
    }
  };

  const handleAccentColorSelect = async (color: string) => {
    setAccentColor(color);
    if (carouselData) {
      const serialized = JSON.stringify({
        type: "carousel",
        title: carouselData.title,
        slides: carouselData.slides,
        templateId: selectedTemplate,
        accentColor: color,
        backgroundImage: carouselData.backgroundImage || backgroundImage,
      });
      await savePostToSupabase(serialized, hashtags, "pending_approval");
    }
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

      const slideBgImage = slide.image || carouselData.backgroundImage || backgroundImage;
      let slideBgImgElement: HTMLImageElement | undefined = undefined;

      if (slideBgImage) {
        slideBgImgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Failed to load background image"));
          img.src = slideBgImage;
        });
      }

      drawSlideToCanvas(ctx, slide, i, slides.length, selectedTemplate, accentColor, slideBgImgElement);

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (i > 0) {
        doc.addPage([1080, 1080], "portrait");
      }
      doc.addImage(imgData, "JPEG", 0, 0, 1080, 1080);
    }
    return doc;
  };

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

  const handlePublish = async () => {
    if (!carouselData || !postId) {
      alert("Carousel draft not saved yet. Please wait.");
      return;
    }
    setPublishing(true);
    
    try {
      // 1. Generate PDF base64
      const doc = await generatePdfDocument();
      const pdfBase64 = doc.output("datauristring");

      // 2. Publish now
      const selectedBackend = localStorage.getItem("voicepost_ai_backend") || "antigravity";
      const pubRes = await fetch(`/api/posts/${postId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backend: selectedBackend,
          carousel_pdf: pdfBase64,
        }),
      });
      const pubData = await pubRes.json();

      if (pubRes.status === 403 && pubData.limit_hit) {
        alert(`${pubData.title}: ${pubData.body}`);
        router.push("/pricing");
      } else if (pubData.success) {
        setPublished(true);
        // Save post update
        const serialized = JSON.stringify({
          type: "carousel",
          title: carouselData.title,
          slides: carouselData.slides,
          templateId: selectedTemplate,
          accentColor: accentColor,
          backgroundImage: carouselData.backgroundImage || backgroundImage,
        });
        await savePostToSupabase(serialized, hashtags, "published");

        setTimeout(() => router.push("/posts"), 2000);
      } else if (pubData.pending_review) {
        alert(pubData.message);
        navigator.clipboard.writeText(pubData.post_content + "\n\n" + pubData.hashtags.map((h: string) => `#${h}`).join(" "));
        window.open("https://www.linkedin.com/", "_blank");
        router.push("/posts");
      } else {
        alert("Publish failed: " + (pubData.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Publishing error:", err);
      alert("Publish failed: " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  // ── Step 1: Topic ──────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">What's your carousel about?</h2>
        <p className="text-sm text-zinc-500">Give a topic, idea, or paste a rough draft — AI does the rest.</p>
      </div>

      <div className="ios-card p-4">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. '5 pricing mistakes SaaS founders make' or paste your raw thoughts here..."
          rows={5}
          className="w-full bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 resize-none outline-none leading-relaxed"
          autoFocus
        />
      </div>

      {/* Slide count */}
      <div className="ios-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Number of slides</p>
            <p className="text-xs text-zinc-400 mt-0.5">5–7 slides perform best on LinkedIn</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSlideCount(Math.max(4, slideCount - 1))}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center active:scale-95 transition-transform border-none cursor-pointer"
            >
              <Minus className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </button>
            <span className="text-xl font-black text-zinc-900 dark:text-white w-6 text-center">{slideCount}</span>
            <button
              onClick={() => setSlideCount(Math.min(8, slideCount + 1))}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center active:scale-95 transition-transform border-none cursor-pointer"
            >
              <Plus className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Background Image Upload */}
      <div className="ios-card p-4">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Slide Background Image (Optional)</p>
        <p className="text-xs text-zinc-400 mb-3">Upload an image to overlay slides on top of it.</p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            id="carousel-bg-upload-step1"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                  setBackgroundImage(reader.result as string);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <label
            htmlFor="carousel-bg-upload-step1"
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-355 bg-zinc-105 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
          >
            {backgroundImage ? "Change Background" : "Upload Image"}
          </label>
          {backgroundImage && (
            <button
              onClick={() => setBackgroundImage(undefined)}
              className="text-xs text-red-500 font-bold hover:underline bg-transparent border-none cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        {backgroundImage && (
          <div className="mt-3 relative w-full aspect-video rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <img src={backgroundImage} alt="Background Preview" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      <button
        onClick={() => setStep(2)}
        disabled={topic.trim().length < 10}
        className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 border-none cursor-pointer"
        style={{ background: topic.trim().length >= 10 ? accentColor : "#9CA3AF" }}
      >
        Choose Template →
      </button>
    </div>
  );

  // ── Step 2: Template + Colors ───────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Pick your style</h2>
        <p className="text-sm text-zinc-500">Choose a template and accent color. You can change these later.</p>
      </div>

      {/* Templates */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2 select-none">
          <Layout className="w-3 h-3" /> Templates
        </p>
        <div className="grid grid-cols-1 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTemplateSelect(t.id)}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                selectedTemplate === t.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                <SlideCanvas
                  slide={{
                    slideNumber: 1,
                    type: "cover",
                    title: t.name,
                    body: "Preview",
                    emoji: "✨",
                  }}
                  templateId={t.id}
                  accentColor={accentColor}
                  slideIndex={0}
                  totalSlides={6}
                  compact={true}
                  backgroundImage={backgroundImage}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">{t.name}</p>
                  {selectedTemplate === t.id && (
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500">{t.description}</p>
                <div className="flex gap-1 mt-1.5">
                  {t.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color Palettes */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2 select-none">
          <Palette className="w-3 h-3" /> Accent Color
        </p>
        <div className="ios-card p-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {COLOR_PALETTES.map((c) => (
              <button
                key={c.accent}
                onClick={() => handleAccentColorSelect(c.accent)}
                className="flex flex-col items-center gap-1.5 group border-none bg-transparent cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-2xl transition-all shadow-md group-active:scale-95 ${
                    accentColor === c.accent ? "ring-2 ring-offset-2 ring-zinc-400 scale-105" : ""
                  }`}
                  style={{ background: `linear-gradient(135deg, ${c.accent} 0%, ${c.dark} 100%)` }}
                />
                <span className="text-[9px] text-zinc-500 text-center leading-tight font-medium">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Custom</label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => handleAccentColorSelect(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
            />
            <code className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
              {accentColor.toUpperCase()}
            </code>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 select-none">Preview</p>
        <div className="w-48 mx-auto rounded-2xl overflow-hidden shadow-2xl">
          <SlideCanvas
            slide={{
              slideNumber: 1,
              type: "cover",
              title: topic.slice(0, 35) || "Your amazing title here",
              body: "Swipe to discover the insights →",
              emoji: "🚀",
            }}
            templateId={selectedTemplate}
            accentColor={accentColor}
            slideIndex={0}
            totalSlides={slideCount}
            backgroundImage={backgroundImage}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          className="flex-1 py-4 rounded-2xl font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 transition-all active:scale-[0.98] border-none cursor-pointer"
        >
          ← Back
        </button>
        <button
          onClick={generateSlides}
          className="flex-1 py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] border-none cursor-pointer"
          style={{ background: accentColor }}
        >
          <Sparkles className="w-4 h-4" />
          Generate Slides
        </button>
      </div>
    </div>
  );

  // ── Step 3: Generating ──────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
        <div
          className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: `${accentColor} transparent transparent transparent` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-7 h-7" style={{ color: accentColor }} />
        </div>
      </div>
      <div className="text-center animate-pulse">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Creating your carousel</h3>
        <p className="text-sm text-zinc-500">{generatingStatus || "Generating slide content with AI..."}</p>
      </div>
      <div className="flex gap-2">
        {[...Array(slideCount)].map((_, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-lg animate-pulse"
            style={{
              background: accentColor,
              opacity: 0.2 + (i * 0.1),
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );

  // ── Step 4: Edit + Preview ──────────────────────────────────────────────────
  const renderStep4 = () => {
    if (!carouselData) return null;
    const slides = carouselData.slides;
    const currentSlide = slides[previewSlide];

    return (
      <div className="flex flex-col gap-5 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Edit & Preview</h2>
            <p className="text-xs text-zinc-500">{slides.length} slides · tap to edit</p>
          </div>
          <button
            onClick={() => { setStep(2); generateSlides(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 border-none cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Canvas Preview & Slide Selection */}
          <div className="space-y-5">
            <div className="relative">
              <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden shadow-2xl">
                <SlideCanvas
                  slide={currentSlide}
                  templateId={selectedTemplate}
                  accentColor={accentColor}
                  slideIndex={previewSlide}
                  totalSlides={slides.length}
                  backgroundImage={currentSlide.image || carouselData?.backgroundImage || backgroundImage}
                />
              </div>
              <button
                onClick={() => startEdit(previewSlide)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 border-none cursor-pointer"
                style={{ background: accentColor }}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {previewSlide > 0 && (
                <button
                  onClick={() => setPreviewSlide(previewSlide - 1)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center active:scale-95 transition-transform border-none cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                </button>
              )}
              {previewSlide < slides.length - 1 && (
                <button
                  onClick={() => setPreviewSlide(previewSlide + 1)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center active:scale-95 transition-transform border-none cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                </button>
              )}
            </div>

            <div className="flex justify-center gap-1.5">
              {slides.map((_, i) => (
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

            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {slides.map((slide, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewSlide(i)}
                  className={`flex-shrink-0 w-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    i === previewSlide ? "scale-105 shadow-lg" : "opacity-60"
                  }`}
                  style={{ borderColor: i === previewSlide ? accentColor : "transparent" }}
                >
                  <SlideCanvas
                    slide={slide}
                    templateId={selectedTemplate}
                    accentColor={accentColor}
                    slideIndex={i}
                    totalSlides={slides.length}
                    compact={true}
                    backgroundImage={slide.image || carouselData?.backgroundImage || backgroundImage}
                  />
                </button>
              ))}
            </div>

            {/* Theme & Design Selection */}
            <div className="border-t border-zinc-150 dark:border-zinc-800 pt-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1.5 select-none">
                  <Layout className="w-3.5 h-3.5 text-cyan-400" />
                  Select Theme / Template
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none scroll-smooth">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTemplateSelect(t.id)}
                      className={`flex-shrink-0 w-24 p-1.5 rounded-2xl border text-center cursor-pointer active:scale-95 transition-all bg-white dark:bg-zinc-900 ${
                        selectedTemplate === t.id ? "border-cyan-500 bg-cyan-950/10" : "border-zinc-200 dark:border-zinc-850"
                      }`}
                    >
                      <p className="font-bold text-[10px] text-zinc-800 dark:text-zinc-200 truncate">{t.name}</p>
                      <div className="mt-1 w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center border border-zinc-100 dark:border-zinc-800 scale-90 shadow-sm">
                        <SlideCanvas
                          slide={{
                            slideNumber: 1,
                            type: "cover",
                            title: "",
                            body: "",
                            emoji: t.id === selectedTemplate ? "✨" : "",
                          }}
                          templateId={t.id}
                          accentColor={accentColor}
                          slideIndex={0}
                          totalSlides={6}
                          compact={true}
                          backgroundImage={carouselData?.backgroundImage || backgroundImage}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1.5 select-none">
                  <Palette className="w-3.5 h-3.5 text-cyan-400" />
                  Accent Color
                </p>
                <div className="ios-card p-3 flex items-center gap-3 overflow-x-auto scrollbar-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850">
                  <div className="flex gap-2">
                    {COLOR_PALETTES.map((c) => (
                      <button
                        key={c.accent}
                        onClick={() => handleAccentColorSelect(c.accent)}
                        className="border-none bg-transparent cursor-pointer relative shrink-0"
                      >
                        <div
                          className="w-7 h-7 rounded-full transition-all shadow-md active:scale-90"
                          style={{ background: `linear-gradient(135deg, ${c.accent} 0%, ${c.dark} 100%)` }}
                        />
                        {accentColor === c.accent && (
                          <div className="absolute inset-0 flex items-center justify-center text-white">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0 mx-1" />
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => handleAccentColorSelect(e.target.value)}
                      className="w-7 h-7 rounded-xl cursor-pointer border-0 bg-transparent shrink-0"
                    />
                    <code className="text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md uppercase shrink-0">
                      {accentColor}
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1.5 select-none">
                  <Layout className="w-3.5 h-3.5 text-cyan-400" />
                  Slide Background Image (Optional)
                </p>
                <div className="ios-card p-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-850">
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id="carousel-bg-upload-step4"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const base64Data = reader.result as string;
                            setBackgroundImage(base64Data);
                            if (carouselData) {
                              const updated = { ...carouselData, backgroundImage: base64Data };
                              setCarouselData(updated);
                              
                              // Save update to Supabase
                              const serialized = JSON.stringify({
                                type: "carousel",
                                title: updated.title,
                                slides: updated.slides,
                                templateId: selectedTemplate,
                                accentColor: accentColor,
                                backgroundImage: base64Data,
                              });
                              await savePostToSupabase(serialized, hashtags, "pending_approval");
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="carousel-bg-upload-step4"
                      className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                    >
                      {carouselData?.backgroundImage || backgroundImage ? "Change Background" : "Upload Background"}
                    </label>
                    {(carouselData?.backgroundImage || backgroundImage) && (
                      <button
                        onClick={async () => {
                          setBackgroundImage(undefined);
                          if (carouselData) {
                            const updated = { ...carouselData };
                            delete updated.backgroundImage;
                            setCarouselData(updated);
                            
                            // Save update to Supabase
                            const serialized = JSON.stringify({
                              type: "carousel",
                              title: updated.title,
                              slides: updated.slides,
                              templateId: selectedTemplate,
                              accentColor: accentColor,
                            });
                            await savePostToSupabase(serialized, hashtags, "pending_approval");
                          }
                        }}
                        className="text-xs text-red-500 font-bold hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {(carouselData?.backgroundImage || backgroundImage) && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                      <img src={carouselData?.backgroundImage || backgroundImage} alt="Thumbnail" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Slide Editor & Main CTA Actions */}
          <div className="space-y-6">
            {editingSlide !== null && editingSlide === previewSlide ? (
              <div className="ios-card p-4 border-2 !mx-0" style={{ borderColor: accentColor }}>
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
                <div className="mb-4">
                  <label className="text-xs text-zinc-500 font-semibold mb-1 block">Slide Background Image (Optional)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      id={`slide-bg-upload-${editingSlide}`}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setEditSlideImage(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor={`slide-bg-upload-${editingSlide}`}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-705 dark:text-zinc-300 bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                    >
                      {editSlideImage ? "Change Image" : "Upload Image"}
                    </label>
                    {editSlideImage && (
                      <button
                        type="button"
                        onClick={() => setEditSlideImage("")}
                        className="text-xs text-red-500 font-bold hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {editSlideImage && (
                    <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-850">
                      <img src={editSlideImage} alt="Slide Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingSlide(null)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 border-none cursor-pointer"
                    style={{ background: accentColor }}
                  >
                    <Check className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="ios-card overflow-hidden !mx-0">
                {slides.map((slide, i) => (
                  <button
                    key={i}
                    onClick={() => { setPreviewSlide(i); startEdit(i); }}
                    className={`w-full flex items-center gap-3 p-3.5 text-left border-b border-zinc-100 dark:border-zinc-800 last:border-0 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition-colors cursor-pointer ${
                      i === previewSlide ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 text-xs font-black"
                      style={{ background: i === previewSlide ? accentColor : "#9CA3AF" }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 font-semibold">
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 truncate">{slide.title}</p>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{slide.body}</p>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Download PDF button */}
            <button
              onClick={downloadPdf}
              disabled={downloadingPdf}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-650 hover:from-blue-600 hover:to-indigo-750 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md border-none cursor-pointer transition-colors"
            >
              {downloadingPdf ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...</>
              ) : (
                <><Download className="w-4 h-4" /> Download PDF</>
              )}
            </button>

            {/* Hashtags */}
            {hashtags.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2 select-none">Hashtags</p>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: `${accentColor}18`, color: accentColor }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (postId) {
                  router.push(`/posts/${postId}/approval`);
                } else {
                  alert("Saving draft. Please wait a moment.");
                }
              }}
              disabled={!postId}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 border-none cursor-pointer"
              style={{ background: accentColor }}
            >
              <Send className="w-4 h-4" />
              Review & Approve →
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Step 5: Publish ─────────────────────────────────────────────────────────
  const renderStep5 = () => {
    if (!carouselData) return null;
    const slides = carouselData.slides;

    return (
      <div className="flex flex-col gap-5 pt-2">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Ready to publish</h2>
          <p className="text-sm text-zinc-500">{slides.length} slides · {hashtags.length} hashtags</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {slides.map((slide, i) => (
            <div key={i} className="rounded-xl overflow-hidden shadow-md">
              <SlideCanvas
                slide={slide}
                templateId={selectedTemplate}
                accentColor={accentColor}
                slideIndex={i}
                totalSlides={slides.length}
                compact={true}
                backgroundImage={slide.image || carouselData?.backgroundImage || backgroundImage}
              />
            </div>
          ))}
        </div>

        <div className="ios-card p-4 space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-zinc-500 font-medium">Template</span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-zinc-500 font-medium">Slides</span>
            <span className="text-zinc-800 dark:text-zinc-200">{slides.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-zinc-500 font-medium">Accent color</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: accentColor }} />
              <span className="font-mono text-xs text-zinc-500">{accentColor.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-start justify-between text-sm font-semibold">
            <span className="text-zinc-500 font-medium">Hashtags</span>
            <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
              {hashtags.slice(0, 4).map((t, i) => (
                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${accentColor}18`, color: accentColor }}>
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {published ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-8 h-8 text-white" />
            </div>
            <p className="font-bold text-zinc-900 dark:text-white">Published to LinkedIn! 🎉</p>
            <p className="text-sm text-zinc-500">Redirecting to your posts...</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row-reverse md:justify-start gap-3">
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full md:w-auto md:px-8 py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 border-none cursor-pointer"
              style={{ background: accentColor }}
            >
              {publishing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</>
              ) : (
                <><Send className="w-4 h-4" /> Publish to LinkedIn</>
              )}
            </button>
            <button
              onClick={() => setStep(4)}
              className="w-full md:w-auto md:px-8 py-3.5 rounded-2xl font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 transition-all active:scale-[0.98] text-sm border-none cursor-pointer"
            >
              ← Edit slides
            </button>
          </div>
        )}
      </div>
    );
  };

  const STEPS = ["Topic", "Design", "AI Magic", "Edit", "Publish"];
  const visibleStep = Math.min(step, 5);

  return (
    <IosShell>
      <div className="pt-4 pb-36 md:pb-10 px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 select-none">
          <button
            onClick={() => (step <= 1 ? router.back() : setStep(Math.max(1, step - 1)))}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center active:scale-95 transition-transform border-none cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-zinc-900 dark:text-white">Carousel Builder</h1>
            <p className="text-xs text-zinc-400">AI-powered LinkedIn carousels</p>
          </div>
          <div className="w-3 h-3 rounded-full" style={{ background: accentColor }} />
        </div>

        {/* Progress bar */}
        {step !== 3 && (
          <div className="mb-6 select-none">
            <div className="flex justify-between mb-2">
              {STEPS.map((label, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                      i + 1 < visibleStep
                        ? "bg-green-500 text-white"
                        : i + 1 === visibleStep
                        ? "text-white"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                    }`}
                    style={i + 1 === visibleStep ? { background: accentColor } : {}}
                  >
                    {i + 1 < visibleStep ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-[9px] font-semibold ${i + 1 === visibleStep ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((visibleStep - 1) / (STEPS.length - 1)) * 100}%`, background: accentColor }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>
    </IosShell>
  );
}

export default function CarouselBuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <CarouselBuilderContent />
    </Suspense>
  );
}
