"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, RefreshCw } from "lucide-react";

interface Slide {
  id: string;
  type: "cover" | "content" | "cta";
  title?: string;
  paragraph?: string;
  badge?: string;
  image?: string;
}

interface RemotionCarouselProps {
  slides: Slide[];
  accentColor: string;
  templateId: string;
}

export function RemotionCarouselPlayer({
  slides,
  accentColor,
  templateId,
}: RemotionCarouselProps) {
  const [PlayerComp, setPlayerComp] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Load Remotion player dynamically on client side only to avoid SSR issues
  useEffect(() => {
    import("@remotion/player").then((mod) => {
      setPlayerComp(() => mod.Player);
    });
  }, []);

  if (!PlayerComp || !slides || slides.length === 0) {
    return (
      <div className="w-full aspect-square bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
        <span className="text-zinc-500 text-xs animate-pulse">Loading Video Preview...</span>
      </div>
    );
  }

  // Each slide lasts 60 frames (2 seconds at 30fps)
  const fps = 30;
  const slideDurationFrames = 60;
  const totalDurationFrames = slides.length * slideDurationFrames;

  // Remotion Composition inside Player
  const AnimatedSlidesComposition = () => {
    const config = { width: 1080, height: 1080 };
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#0F0F0F",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
          color: "white",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          boxSizing: "border-box",
        }}
      >
        {/* Animated Accent Bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "20px",
            background: accentColor || "#3b82f6",
          }}
        />

        {slides.map((slide, index) => {
          const startFrame = index * slideDurationFrames;
          const endFrame = startFrame + slideDurationFrames;
          const isVisible = currentFrame >= startFrame && currentFrame < endFrame;

          if (!isVisible) return null;

          // Simple transition: Fade-in during first 10 frames of visibility
          const opacity = Math.min(1, (currentFrame - startFrame) / 10);

          return (
            <div
              key={slide.id || index}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                justifyContent: "space-between",
                opacity,
              }}
            >
              {/* Badge / Index */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    backgroundColor: `${accentColor}20`,
                    color: accentColor,
                    fontSize: "20px",
                    fontWeight: "bold",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    textTransform: "uppercase",
                  }}
                >
                  {slide.badge || (slide.type === "cover" ? "Introduction" : slide.type === "cta" ? "Call to Action" : "Insight")}
                </span>
                <span style={{ fontSize: "20px", fontWeight: "bold", color: "#666" }}>
                  {index + 1} / {slides.length}
                </span>
              </div>

              {/* Title & Body */}
              <div style={{ margin: "auto 0" }}>
                <h1
                  style={{
                    fontSize: "54px",
                    fontWeight: "900",
                    lineHeight: "1.15",
                    marginBottom: "24px",
                    color: "white",
                  }}
                >
                  {slide.title}
                </h1>
                <p
                  style={{
                    fontSize: "28px",
                    color: "#A1A1AA",
                    lineHeight: "1.5",
                    margin: 0,
                  }}
                >
                  {slide.paragraph}
                </p>
              </div>

              {/* Brand Indicator */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #27272A", paddingTop: "24px" }}>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#A1A1AA" }}>
                  VoicePost Social Studio
                </span>
                <span style={{ fontSize: "16px", color: accentColor, fontWeight: "bold" }}>
                  Swipe Left ●
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const PlayerElement = PlayerComp;

  return (
    <div className="w-full bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-xl p-4">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Animated Video Playback (Remotion)
        </h3>
        <span className="text-[10px] text-zinc-500 font-medium">
          Slide {Math.floor(currentFrame / slideDurationFrames) + 1} / {slides.length}
        </span>
      </div>

      <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-inner">
        <PlayerElement
          component={AnimatedSlidesComposition}
          durationInFrames={totalDurationFrames}
          fps={fps}
          compositionWidth={1080}
          compositionHeight={1080}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          loop
          autoPlay={false}
          inputProps={{}}
          ref={(playerRef: any) => {
            if (!playerRef) return;
            // Listen to frame changes from the player to coordinate visual state
            const handleFrameChange = (e: CustomEvent<{ frame: number }>) => {
              setCurrentFrame(e.detail.frame);
            };
            playerRef.addEventListener("framechange", handleFrameChange);
          }}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center items-center gap-4 mt-4">
        <button
          onClick={() => {
            const videoEl = document.querySelector("video");
            if (videoEl) {
              if (isPlaying) {
                videoEl.pause();
                setIsPlaying(false);
              } else {
                videoEl.play();
                setIsPlaying(true);
              }
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-bold text-xs border border-zinc-700 cursor-pointer transition-all"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? "Pause Preview" : "Play Slideshow"}
        </button>

        <button
          onClick={() => {
            const videoEl = document.querySelector("video");
            if (videoEl) {
              videoEl.currentTime = 0;
              setCurrentFrame(0);
            }
          }}
          className="flex items-center gap-1 px-3 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-semibold text-xs border border-zinc-800 cursor-pointer transition-all"
        >
          <RefreshCw className="w-3 h-3" /> Restart
        </button>
      </div>
    </div>
  );
}
