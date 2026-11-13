"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Play, Pause, RefreshCw } from "lucide-react";

/** Carousel slide as stored on the post (see the approval page's Slide type). */
export interface CarouselVideoSlide {
  type: "cover" | "content" | "cta";
  title?: string;
  body?: string;
  subtitle?: string;
  badge?: string;
  points?: Array<{ title: string; text: string }>;
  metrics?: Array<{ value: string; label: string; text: string }>;
}

interface RemotionCarouselProps {
  slides: CarouselVideoSlide[];
  accentColor: string;
  templateId: string;
}

const FPS = 30;
const SLIDE_FRAMES = 60; // 2 seconds per slide
const FADE_FRAMES = 10;

interface CompositionProps {
  slides: CarouselVideoSlide[];
  accentColor: string;
}

function slideText(slide: CarouselVideoSlide): string {
  if (slide.body) return slide.body;
  if (slide.subtitle) return slide.subtitle;
  if (slide.points?.length) return slide.points.map((p) => `• ${p.title}`).join("\n");
  if (slide.metrics?.length) return slide.metrics.map((m) => `${m.value} ${m.label}`).join("  ·  ");
  return "";
}

function SlideView({ slide, index, total, accent }: { slide: CarouselVideoSlide; index: number; total: number; accent: string }) {
  // Inside a <Sequence>, useCurrentFrame() is relative to the start of this slide.
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: "clamp" });
  const lift = interpolate(frame, [0, FADE_FRAMES], [24, 0], { extrapolateRight: "clamp" });
  const label = slide.badge || (slide.type === "cover" ? "Introduction" : slide.type === "cta" ? "Call to Action" : "Insight");

  return (
    <AbsoluteFill
      style={{
        padding: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity,
        fontFamily: "system-ui, sans-serif",
        color: "white",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            backgroundColor: `${accent}20`,
            color: accent,
            fontSize: 20,
            fontWeight: 700,
            padding: "8px 16px",
            borderRadius: 20,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#71717A" }}>
          {index + 1} / {total}
        </span>
      </div>

      <div style={{ transform: `translateY(${lift}px)` }}>
        <h1 style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.15, margin: "0 0 24px" }}>{slide.title}</h1>
        <p style={{ fontSize: 28, color: "#A1A1AA", lineHeight: 1.5, margin: 0, whiteSpace: "pre-line" }}>
          {slideText(slide)}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "2px solid #27272A",
          paddingTop: 24,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, color: "#A1A1AA" }}>VoicePost Social Studio</span>
        <span style={{ fontSize: 16, color: accent, fontWeight: 700 }}>
          {index === total - 1 ? "Follow for more" : "Swipe Left ●"}
        </span>
      </div>
    </AbsoluteFill>
  );
}

// Defined at module scope so the Player keeps a stable component identity across renders.
function CarouselComposition({ slides, accentColor }: CompositionProps) {
  const accent = accentColor || "#3b82f6";
  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0F0F" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 20, background: accent }} />
      {slides.map((slide, index) => (
        <Sequence key={index} from={index * SLIDE_FRAMES} durationInFrames={SLIDE_FRAMES}>
          <SlideView slide={slide} index={index} total={slides.length} accent={accent} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export function RemotionCarouselPlayer({ slides, accentColor }: RemotionCarouselProps) {
  const [PlayerComp, setPlayerComp] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // Track the slide, not the frame: frameupdate fires 30x/s and only the slide label changes.
  const [slideIndex, setSlideIndex] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const hasSlides = Boolean(slides && slides.length > 0);
  // Stable object so the Player does not re-render the composition on every parent render.
  const inputProps = useMemo(() => ({ slides, accentColor }), [slides, accentColor]);

  // Load the Remotion player on the client only (avoids SSR issues).
  useEffect(() => {
    let cancelled = false;
    import("@remotion/player")
      .then((mod) => {
        if (!cancelled) setPlayerComp(() => mod.Player);
      })
      .catch((err) => {
        console.error("Failed to load video player:", err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe once per mounted player and always unsubscribe. The player only mounts
  // once both the module and the slides are there, so depend on both.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) =>
      setSlideIndex(Math.floor(e.detail.frame / SLIDE_FRAMES));
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [PlayerComp, hasSlides]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play();
  }, []);

  const restart = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(0);
    setSlideIndex(0);
    player.play();
  }, []);

  if (loadError) {
    return (
      <div className="w-full aspect-square bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
        <span className="text-zinc-500 text-xs">Video preview couldn&apos;t load. Use the PDF Canvas view.</span>
      </div>
    );
  }

  if (!PlayerComp || !hasSlides) {
    return (
      <div className="w-full aspect-square bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
        <span className="text-zinc-500 text-xs animate-pulse">Loading Video Preview...</span>
      </div>
    );
  }

  const Player = PlayerComp;
  const currentSlide = Math.min(slideIndex, slides.length - 1) + 1;

  return (
    <div className="w-full bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-xl p-4">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full bg-red-500 ${isPlaying ? "animate-pulse" : ""}`} /> Animated Video Playback
        </h3>
        <span className="text-[10px] text-zinc-500 font-medium">
          Slide {currentSlide} / {slides.length}
        </span>
      </div>

      <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-inner">
        <Player
          ref={playerRef}
          component={CarouselComposition}
          inputProps={inputProps}
          durationInFrames={slides.length * SLIDE_FRAMES}
          fps={FPS}
          compositionWidth={1080}
          compositionHeight={1080}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          loop
          autoPlay={false}
        />
      </div>

      <div className="flex justify-center items-center gap-4 mt-4">
        <button
          type="button"
          onClick={togglePlay}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-bold text-xs border border-zinc-700 cursor-pointer transition-all"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? "Pause Preview" : "Play Slideshow"}
        </button>

        <button
          type="button"
          onClick={restart}
          className="flex items-center gap-1 px-3 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-semibold text-xs border border-zinc-800 cursor-pointer transition-all"
        >
          <RefreshCw className="w-3 h-3" /> Restart
        </button>
      </div>
    </div>
  );
}
