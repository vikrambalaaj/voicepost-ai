"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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

// ─── Slide Canvas Renderer ───────────────────────────────────────────────────

function SlideCanvas({
  slide,
  templateId,
  accentColor,
  slideIndex,
  totalSlides,
  compact = false,
}: {
  slide: Slide;
  templateId: string;
  accentColor: string;
  slideIndex: number;
  totalSlides: number;
  compact?: boolean;
}) {
  const isCover = slide.type === "cover";
  const isCta = slide.type === "cta";
  const padding = compact ? "p-4" : "p-7";

  // Gradient for gradient_flow template
  const getGradientStyle = () => {
    const h = parseInt(accentColor.slice(1), 16);
    return `linear-gradient(135deg, ${accentColor} 0%, #0F0F0F 100%)`;
  };

  if (templateId === "bold_impact") {
    return (
      <div
        className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden`}
        style={{ background: "#0F0F0F", fontFamily: "system-ui, sans-serif" }}
      >
        {/* Accent bar top */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accentColor }} />
        {/* Slide counter */}
        <div className="flex justify-between items-center mb-auto">
          <div className={`${compact ? "text-[9px]" : "text-xs"} font-bold uppercase tracking-widest`} style={{ color: accentColor }}>
            {isCover ? "●●●●●" : `${slideIndex + 1} / ${totalSlides}`}
          </div>
          {!compact && <div className="text-2xl">{slide.emoji}</div>}
        </div>
        {/* Content */}
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
        {/* Bottom brand bar */}
        {isCover && (
          <div className={`mt-3 flex items-center gap-2 ${compact ? "pt-2" : "pt-4"} border-t border-zinc-800`}>
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
        className={`relative w-full aspect-square flex flex-col ${padding} overflow-hidden bg-white`}
        style={{ fontFamily: "Georgia, serif" }}
      >
        {/* Left accent line */}
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
        style={{ background: getGradientStyle(), fontFamily: "system-ui, sans-serif" }}
      >
        {/* Glow circle */}
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
        {/* Left panel */}
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
        {/* Right panel */}
        <div className={`flex-1 flex flex-col justify-between ${compact ? "p-3" : "p-6"}`}>
          <div
            className={`${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} rounded-full font-bold w-fit`}
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {isCover ? "Swipe →" : isCta ? "Follow" : `Step ${slideIndex}`}
          </div>
          <div>
            <h2
              className={`font-black leading-tight text-zinc-900 ${compact ? "text-[11px] mb-1" : "text-xl mb-3"}`}
            >
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
        background: `linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E1B4B 100%)`,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Stars decoration */}
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
      {/* Glass card */}
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
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CarouselBuilderPage() {
  const router = useRouter();

  // Step: 1=topic, 2=template+colors, 3=generating, 4=edit+preview, 5=publish
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [selectedTemplate, setSelectedTemplate] = useState("bold_impact");
  const [accentColor, setAccentColor] = useState("#3B82F6");
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState("");
  const [carouselData, setCarouselData] = useState<CarouselData | null>(null);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

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
      setHashtags(data.carousel.suggestedHashtags || []);
      setPreviewSlide(0);
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
    setEditingSlide(idx);
  };

  const saveEdit = () => {
    if (editingSlide === null || !carouselData) return;
    const updated = { ...carouselData };
    updated.slides[editingSlide].title = editTitle;
    updated.slides[editingSlide].body = editBody;
    setCarouselData(updated);
    setEditingSlide(null);
  };

  const handlePublish = async () => {
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 2000)); // simulate publish
    setPublished(true);
    setPublishing(false);
    setTimeout(() => router.push("/posts"), 2000);
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
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Minus className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </button>
            <span className="text-xl font-black text-zinc-900 dark:text-white w-6 text-center">{slideCount}</span>
            <button
              onClick={() => setSlideCount(Math.min(8, slideCount + 1))}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep(2)}
        disabled={topic.trim().length < 10}
        className="w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
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
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
          <Layout className="w-3 h-3" /> Templates
        </p>
        <div className="grid grid-cols-1 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                selectedTemplate === t.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              }`}
            >
              {/* Mini template preview */}
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
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
          <Palette className="w-3 h-3" /> Accent Color
        </p>
        <div className="ios-card p-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {COLOR_PALETTES.map((c) => (
              <button
                key={c.accent}
                onClick={() => setAccentColor(c.accent)}
                className="flex flex-col items-center gap-1.5 group"
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
          {/* Custom color */}
          <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Custom</label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
            />
            <code className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
              {accentColor.toUpperCase()}
            </code>
          </div>
        </div>
      </div>

      {/* Live preview of first slide */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Preview</p>
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
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          className="flex-1 py-4 rounded-2xl font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 transition-all active:scale-[0.98]"
        >
          ← Back
        </button>
        <button
          onClick={generateSlides}
          className="flex-1 py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
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
      <div className="text-center">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Creating your carousel</h3>
        <p className="text-sm text-zinc-500">{generatingStatus || "Generating slide content with AI..."}</p>
      </div>
      {/* Animated slide placeholders */}
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Edit & Preview</h2>
            <p className="text-xs text-zinc-500">{slides.length} slides · tap to edit</p>
          </div>
          <button
            onClick={() => { setStep(2); generateSlides(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
        </div>

        {/* Main slide preview */}
        <div className="relative">
          <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden shadow-2xl">
            <SlideCanvas
              slide={currentSlide}
              templateId={selectedTemplate}
              accentColor={accentColor}
              slideIndex={previewSlide}
              totalSlides={slides.length}
            />
          </div>
          {/* Edit overlay button */}
          <button
            onClick={() => startEdit(previewSlide)}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95"
            style={{ background: accentColor }}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {/* Nav arrows */}
          {previewSlide > 0 && (
            <button
              onClick={() => setPreviewSlide(previewSlide - 1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </button>
          )}
          {previewSlide < slides.length - 1 && (
            <button
              onClick={() => setPreviewSlide(previewSlide + 1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronRight className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </button>
          )}
        </div>

        {/* Slide counter dots */}
        <div className="flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setPreviewSlide(i)}
              className="rounded-full transition-all"
              style={{
                width: i === previewSlide ? 20 : 6,
                height: 6,
                background: i === previewSlide ? accentColor : "#D1D5DB",
              }}
            />
          ))}
        </div>

        {/* Thumbnail strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => setPreviewSlide(i)}
              className={`flex-shrink-0 w-16 rounded-xl overflow-hidden border-2 transition-all ${
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
              />
            </button>
          ))}
        </div>

        {/* Current slide text editor inline */}
        {editingSlide !== null && editingSlide === previewSlide ? (
          <div className="ios-card p-4 border-2" style={{ borderColor: accentColor }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: accentColor }}>
              Editing Slide {editingSlide + 1}
            </p>
            <div className="mb-3">
              <label className="text-xs text-zinc-500 font-semibold mb-1 block">Headline</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:ring-2"
                style={{ "--tw-ring-color": accentColor } as any}
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
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: accentColor }}
              >
                <Check className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        ) : (
          /* Slide list summary */
          <div className="ios-card overflow-hidden">
            {slides.map((slide, i) => (
              <button
                key={i}
                onClick={() => { setPreviewSlide(i); startEdit(i); }}
                className={`w-full flex items-center gap-3 p-3.5 text-left border-b border-zinc-100 dark:border-zinc-800 last:border-0 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition-colors ${
                  i === previewSlide ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
                }`}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 text-xs font-black"
                  style={{ background: i === previewSlide ? accentColor : "#9CA3AF" }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{slide.title}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{slide.body}</p>
                </div>
                <Edit3 className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Hashtags</p>
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

        {/* CTA */}
        <button
          onClick={() => setStep(5)}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: accentColor }}
        >
          <Send className="w-4 h-4" />
          Review & Publish →
        </button>
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

        {/* All slides compact grid */}
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
              />
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="ios-card p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 font-medium">Template</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 font-medium">Slides</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{slides.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 font-medium">Accent color</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: accentColor }} />
              <span className="font-mono text-xs text-zinc-500">{accentColor.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-start justify-between text-sm">
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
          <div className="flex flex-col gap-3">
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: accentColor }}
            >
              {publishing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Publishing to LinkedIn...</>
              ) : (
                <><Send className="w-4 h-4" /> Publish to LinkedIn</>
              )}
            </button>
            <button
              onClick={() => setStep(4)}
              className="w-full py-3.5 rounded-2xl font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 transition-all active:scale-[0.98] text-sm"
            >
              ← Edit slides
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Step labels ─────────────────────────────────────────────────────────────
  const STEPS = ["Topic", "Design", "AI Magic", "Edit", "Publish"];
  const visibleStep = Math.min(step, 5);

  return (
    <IosShell>
      <div className="pt-4 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => (step <= 1 ? router.back() : setStep(Math.max(1, step - 1)))}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-zinc-900 dark:text-white">Carousel Builder</h1>
            <p className="text-xs text-zinc-400">AI-powered LinkedIn carousels</p>
          </div>
          {/* Accent dot */}
          <div className="w-3 h-3 rounded-full" style={{ background: accentColor }} />
        </div>

        {/* Progress bar */}
        {step !== 3 && (
          <div className="mb-6">
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
