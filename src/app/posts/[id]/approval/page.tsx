"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import {
  ArrowLeft, Check, AlertTriangle, Plus, X, Clock, HelpCircle,
  History, Sparkles, Download, ChevronLeft, ChevronRight, Edit3, Loader2, Layout, Palette,
  Mic, Paperclip, Square, CheckCircle2, ExternalLink, ImageIcon, Trash2, Upload
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
  subtitle?: string;
  points?: Array<{ title: string; text: string }>;
  footer?: string;
  layout?: "paragraph" | "points" | "metrics";
  badge?: string;
  metrics?: Array<{ value: string; label: string; text: string }>;
  image?: string;
}

interface SlidePoint {
  title: string;
  text: string;
}

interface SlideMetric {
  value: string;
  label: string;
  text: string;
}

function getSlideMetrics(slide: Slide): SlideMetric[] {
  if (slide.metrics && slide.metrics.length > 0) {
    return slide.metrics;
  }
  if (!slide.body) return [];
  
  const lines = slide.body.split("\n").map(l => l.trim()).filter(Boolean);
  const metrics: SlideMetric[] = [];
  
  for (const line of lines) {
    const clean = line.replace(/^[•\-\d\.\s\*\u2022]+/g, "").trim();
    if (!clean) continue;
    
    let value = "";
    let label = "";
    let text = clean;
    
    const pipeParts = clean.split("|");
    if (pipeParts.length >= 3) {
      value = pipeParts[0].trim().replace(/\*\*/g, "");
      label = pipeParts[1].trim();
      text = pipeParts[2].trim();
    } else {
      const colonIndex = clean.indexOf(":");
      const dashIndex = clean.indexOf(" - ");
      if (colonIndex > 0 && dashIndex > colonIndex) {
        value = clean.substring(0, colonIndex).trim().replace(/\*\*/g, "");
        label = clean.substring(colonIndex + 1, dashIndex).trim();
        text = clean.substring(dashIndex + 3).trim();
      } else if (dashIndex > 0 && colonIndex > dashIndex) {
        value = clean.substring(0, dashIndex).trim().replace(/\*\*/g, "");
        label = clean.substring(dashIndex + 3, colonIndex).trim();
        text = clean.substring(colonIndex + 1).trim();
      } else if (colonIndex > 0) {
        value = clean.substring(0, colonIndex).trim().replace(/\*\*/g, "");
        label = "";
        text = clean.substring(colonIndex + 1).trim();
      }
    }
    
    if (value) {
      metrics.push({ value, label, text });
    }
  }
  
  if (metrics.length === 0 && lines.length >= 3) {
    for (let i = 0; i + 2 < lines.length; i += 3) {
      metrics.push({
        value: lines[i].replace(/\*\*/g, "").trim(),
        label: lines[i+1].trim(),
        text: lines[i+2].trim()
      });
    }
  }
  
  return metrics;
}

function getSlidePoints(slide: Slide): SlidePoint[] {
  if (slide.points && slide.points.length > 0) {
    return slide.points;
  }
  if (!slide.body) return [];
  
  // Let's parse bullet points from body as fallback
  const lines = slide.body.split("\n").map(l => l.trim()).filter(Boolean);
  const pts: SlidePoint[] = [];
  for (const line of lines) {
    const clean = line.replace(/^[•\-\d\.\s\*\u2022]+/g, "").trim();
    if (!clean) continue;
    
    let title = "";
    let text = clean;
    
    const boldMatch = clean.match(/^\*\*([^*]+)\*\*:(.*)$/) || clean.match(/^\*([^*]+)\*:(.*)$/);
    if (boldMatch) {
      title = boldMatch[1].trim();
      text = boldMatch[2].trim();
    } else {
      const colonIndex = clean.indexOf(":");
      const dashIndex = clean.indexOf(" - ");
      if (colonIndex > 0 && colonIndex < 50) {
        title = clean.substring(0, colonIndex).trim();
        text = clean.substring(colonIndex + 1).trim();
      } else if (dashIndex > 0 && dashIndex < 50) {
        title = clean.substring(0, dashIndex).trim();
        text = clean.substring(dashIndex + 3).trim();
      }
    }
    pts.push({ title, text });
  }
  return pts;
}

function drawSlidePointsToCanvas(
  ctx: CanvasRenderingContext2D,
  points: SlidePoint[],
  subtitle: string | undefined,
  footer: string | undefined,
  startY: number,
  width: number,
  accentColor: string,
  templateId: string,
  isDark: boolean
) {
  let currentY = startY;
  
  // 1. Draw subtitle tagline if present
  if (subtitle) {
    ctx.save();
    const paddingLeft = templateId === "minimal_clean" ? 100 : 130;
    // Left vertical accent line
    ctx.fillStyle = accentColor;
    ctx.fillRect(paddingLeft - 20, currentY - 20, 4, 32);
    
    ctx.fillStyle = isDark ? "#A1A1AA" : "#4B5563";
    ctx.font = templateId === "minimal_clean" ? "italic 28px Georgia, serif" : "italic 28px system-ui, sans-serif";
    currentY = wrapText(ctx, `"${subtitle}"`, paddingLeft, currentY, width - 40, 38) + 40;
    ctx.restore();
  } else {
    currentY += 15;
  }
  
  // 2. Draw Points
  const maxPointsY = footer ? 920 : 980;
  const availableSpace = maxPointsY - currentY;
  const pointCount = Math.min(points.length, 3);
  const pointSpacing = pointCount > 0 ? Math.min(210, availableSpace / pointCount) : 210;
  
  const leftPadding = templateId === "minimal_clean" ? 100 : 130;
  const contentWidth = width - (leftPadding - 80) - 20;
  
  for (let i = 0; i < pointCount; i++) {
    const pt = points[i];
    const ptY = currentY + i * pointSpacing;
    
    ctx.save();
    
    if (templateId === "minimal_clean") {
      // Horizontal accent divider lines and number
      ctx.strokeStyle = `${accentColor}40`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftPadding, ptY);
      ctx.lineTo(leftPadding + contentWidth, ptY);
      ctx.stroke();
      
      ctx.fillStyle = "#71717A";
      ctx.font = "normal 22px Georgia, serif";
      ctx.fillText(`0${i+1}`, leftPadding, ptY + 35);
      
      ctx.fillStyle = "#18181B";
      ctx.font = "bold 32px Georgia, serif";
      const headingNextY = wrapText(ctx, pt.title || "", leftPadding, ptY + 75, contentWidth, 42);
      
      ctx.fillStyle = "#3F3F46";
      ctx.font = "normal 26px Georgia, serif";
      wrapText(ctx, pt.text, leftPadding, headingNextY + 12, contentWidth, 36);
    } else {
      // Nice card containers for other templates
      const cardBg = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)";
      
      ctx.fillStyle = cardBg;
      drawRoundedRect(ctx, leftPadding - 30, ptY, contentWidth + 30, pointSpacing - 20, 12);
      ctx.fill();
      
      ctx.fillStyle = accentColor;
      ctx.fillRect(leftPadding - 30, ptY + 10, 6, pointSpacing - 40);
      
      ctx.fillStyle = isDark ? "#FFFFFF" : "#18181B";
      ctx.font = "bold 30px system-ui, sans-serif";
      const headingNextY = wrapText(ctx, pt.title || "", leftPadding, ptY + 38, contentWidth - 20, 38);
      
      ctx.fillStyle = isDark ? "#D1D5DB" : "#4B5563";
      ctx.font = "normal 24px system-ui, sans-serif";
      wrapText(ctx, pt.text, leftPadding, headingNextY + 10, contentWidth - 20, 32);
    }
    
    ctx.restore();
  }
  
  // 3. Draw Footer Highlight Banner
  if (footer) {
    ctx.save();
    const footerY = 940;
    const paddingX = templateId === "minimal_clean" ? 100 : 80;
    const footerWidth = 1080 - paddingX * 2;
    
    ctx.fillStyle = "rgba(34, 197, 94, 0.12)";
    drawRoundedRect(ctx, paddingX, footerY, footerWidth, 85, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(34, 197, 94, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.fillStyle = "#22C55E";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText("✓", paddingX + 25, footerY + 48);
    
    ctx.fillStyle = isDark ? "#E2E8F0" : "#1F2937";
    ctx.font = "normal 22px system-ui, sans-serif";
    wrapText(ctx, footer, paddingX + 65, footerY + 48, footerWidth - 90, 30);
    ctx.restore();
  }
}

// ─── Canvas Helper Drawing Functions ────────────────────────────────────────

function renderHighlightedText(text: string, accentColor: string) {
  if (!text) return "";
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const clean = part.slice(2, -2);
      return <span key={i} style={{ color: accentColor }}>{clean}</span>;
    }
    return part;
  });
}

function drawTitleWithHighlights(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  baseColor: string,
  accentColor: string
) {
  const words = text.split(/\s+/);
  const lines: Array<Array<{ word: string; isAccent: boolean }>> = [];
  let currentLine: Array<{ word: string; isAccent: boolean }> = [];
  let currentLineWidth = 0;
  
  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    if (!rawWord) continue;
    
    const isAccent = rawWord.includes("**");
    const cleanWord = rawWord.replace(/\*\*/g, "");
    
    const spaceWidth = currentLine.length > 0 ? ctx.measureText(" ").width : 0;
    const wordWidth = ctx.measureText(cleanWord).width;
    
    if (currentLineWidth + spaceWidth + wordWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [{ word: cleanWord, isAccent }];
      currentLineWidth = wordWidth;
    } else {
      currentLine.push({ word: cleanWord, isAccent });
      currentLineWidth += spaceWidth + wordWidth;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  let currentY = y;
  for (const line of lines) {
    let currentX = x;
    for (let j = 0; j < line.length; j++) {
      const item = line[j];
      ctx.fillStyle = item.isAccent ? accentColor : baseColor;
      ctx.fillText(item.word, currentX, currentY);
      
      const wordWidth = ctx.measureText(item.word).width;
      const spaceWidth = ctx.measureText(" ").width;
      currentX += wordWidth + spaceWidth;
    }
    currentY += lineHeight;
  }
  return currentY;
}

function drawSlideBadgeToCanvas(
  ctx: CanvasRenderingContext2D,
  badge: string,
  x: number,
  y: number,
  accentColor: string
) {
  ctx.save();
  ctx.font = "bold 20px system-ui, sans-serif";
  const badgeText = badge.toUpperCase();
  const textWidth = ctx.measureText(badgeText).width;
  
  const px = 14;
  const rectX = x;
  const rectY = y - 22;
  const rectW = textWidth + px * 2;
  const rectH = 34;
  
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, rectX, rectY, rectW, rectH, 6);
  ctx.stroke();
  
  ctx.fillStyle = accentColor;
  ctx.fillText(badgeText, rectX + px, y + 2);
  ctx.restore();
  return rectW;
}

function drawSlideMetricsToCanvas(
  ctx: CanvasRenderingContext2D,
  metrics: SlideMetric[],
  subtitle: string | undefined,
  body: string | undefined,
  footer: string | undefined,
  startY: number,
  width: number,
  accentColor: string,
  templateId: string,
  isDark: boolean
) {
  let currentY = startY;
  
  // 1. Subtitle Tagline
  if (subtitle) {
    ctx.save();
    const paddingLeft = templateId === "minimal_clean" ? 100 : 130;
    ctx.fillStyle = accentColor;
    ctx.fillRect(paddingLeft - 20, currentY - 20, 4, 32);
    
    ctx.fillStyle = isDark ? "#A1A1AA" : "#4B5563";
    ctx.font = templateId === "minimal_clean" ? "italic 28px Georgia, serif" : "italic 28px system-ui, sans-serif";
    currentY = wrapText(ctx, `"${subtitle}"`, paddingLeft, currentY, width - 40, 38) + 30;
    ctx.restore();
  }
  
  // 2. Body description
  if (body) {
    ctx.save();
    const paddingLeft = templateId === "minimal_clean" ? 100 : 130;
    ctx.fillStyle = isDark ? "#D1D5DB" : "#4B5563";
    ctx.font = templateId === "minimal_clean" ? "normal 24px Georgia, serif" : "normal 24px system-ui, sans-serif";
    currentY = wrapText(ctx, body, paddingLeft, currentY, width - 40, 34) + 20;
    ctx.restore();
  }
  
  // 3. Metrics Cards
  const maxMetricsY = footer ? 920 : 980;
  const availableSpace = maxMetricsY - currentY;
  const metricCount = Math.min(metrics.length, 3);
  const metricSpacing = metricCount > 0 ? Math.min(185, availableSpace / metricCount) : 185;
  
  const leftPadding = templateId === "minimal_clean" ? 100 : 130;
  const contentWidth = width - (leftPadding - 80) - 20;
  const centerX = leftPadding + contentWidth / 2;
  
  for (let i = 0; i < metricCount; i++) {
    const m = metrics[i];
    const mY = currentY + i * metricSpacing;
    
    ctx.save();
    ctx.textAlign = "center";
    
    ctx.fillStyle = accentColor;
    ctx.font = templateId === "minimal_clean" ? "bold 52px Georgia, serif" : "bold 52px system-ui, sans-serif";
    ctx.fillText(m.value, centerX, mY + 45);
    
    let labelY = mY + 80;
    if (m.label) {
      ctx.fillStyle = isDark ? "#FFFFFF" : "#18181B";
      ctx.font = templateId === "minimal_clean" ? "bold 26px Georgia, serif" : "bold 26px system-ui, sans-serif";
      ctx.fillText(m.label, centerX, labelY);
      labelY += 32;
    }
    
    ctx.fillStyle = isDark ? "#9CA3AF" : "#4B5563";
    ctx.font = templateId === "minimal_clean" ? "normal 22px Georgia, serif" : "normal 22px system-ui, sans-serif";
    wrapText(ctx, m.text, centerX, labelY, contentWidth, 28);
    
    if (i < metricCount - 1) {
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX - 100, mY + metricSpacing - 10);
      ctx.lineTo(centerX + 100, mY + metricSpacing - 10);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

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
  const isContent = !isCover && !isCta;
  const points = isContent ? getSlidePoints(slide) : [];
  const metrics = isContent ? getSlideMetrics(slide) : [];
  const layout = slide.layout || (metrics.length > 0 ? "metrics" : points.length > 0 ? "points" : "paragraph");

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

    // Slide header (Badge & Counter)
    ctx.fillStyle = accentColor;
    ctx.font = "bold 24px system-ui, sans-serif";
    if (isContent && slide.badge) {
      drawSlideBadgeToCanvas(ctx, slide.badge, 80, 110, accentColor);
      ctx.save();
      ctx.textAlign = "right";
      ctx.fillText(`${slideIndex + 1} / ${totalSlides}`, 1000, 110);
      ctx.restore();
    } else {
      ctx.fillText(isCover ? "● ● ● ● ●" : `${slideIndex + 1} / ${totalSlides}`, 80, 110);
    }

    // Title & Body/Content
    if (isContent) {
      let titleNextY = drawTitleWithHighlights(ctx, slide.title, 80, 180, 920, 75, "#FFFFFF", accentColor);
      if (layout === "metrics") {
        drawSlideMetricsToCanvas(ctx, metrics, slide.subtitle, slide.body, slide.footer, titleNextY + 30, 920, accentColor, "bold_impact", true);
      } else if (layout === "points") {
        drawSlidePointsToCanvas(ctx, points, slide.subtitle, slide.footer, titleNextY + 30, 920, accentColor, "bold_impact", true);
      } else {
        ctx.save();
        if (slide.subtitle) {
          ctx.fillStyle = accentColor;
          ctx.fillRect(60, titleNextY + 10, 4, 32);
          ctx.fillStyle = "#A1A1AA";
          ctx.font = "italic 28px system-ui, sans-serif";
          titleNextY = wrapText(ctx, `"${slide.subtitle}"`, 80, titleNextY + 30, 920, 38) + 30;
        }
        ctx.fillStyle = "#A1A1AA";
        ctx.font = "normal 32px system-ui, sans-serif";
        wrapText(ctx, slide.body, 80, titleNextY + 30, 920, 48);
        ctx.restore();
      }
    } else {
      const titleY = isCover ? 450 : 350;
      const titleNextY = drawTitleWithHighlights(ctx, slide.title, 80, titleY, 920, 75, "#FFFFFF", accentColor);
      ctx.fillStyle = "#A1A1AA";
      ctx.font = "normal 32px system-ui, sans-serif";
      wrapText(ctx, slide.body, 80, titleNextY + 30, 920, 48);
    }

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

    // Slide header
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "bold 28px Georgia, serif";
    if (isContent && slide.badge) {
      drawSlideBadgeToCanvas(ctx, slide.badge, 100, 120, accentColor);
      ctx.save();
      ctx.textAlign = "right";
      ctx.fillText(`0${slideIndex + 1}`, 980, 120);
      ctx.restore();
    } else {
      ctx.fillText(isCover ? "Swipe →" : `0${slideIndex + 1}`, 100, 120);
    }

    // Title & Content
    if (isContent) {
      let titleNextY = drawTitleWithHighlights(ctx, slide.title, 100, 180, 880, 75, "#18181B", accentColor);
      if (layout === "metrics") {
        drawSlideMetricsToCanvas(ctx, metrics, slide.subtitle, slide.body, slide.footer, titleNextY + 30, 880, accentColor, "minimal_clean", false);
      } else if (layout === "points") {
        drawSlidePointsToCanvas(ctx, points, slide.subtitle, slide.footer, titleNextY + 30, 880, accentColor, "minimal_clean", false);
      } else {
        ctx.save();
        if (slide.subtitle) {
          ctx.fillStyle = accentColor;
          ctx.fillRect(80, titleNextY + 10, 4, 32);
          ctx.fillStyle = "#4B5563";
          ctx.font = "italic 28px Georgia, serif";
          titleNextY = wrapText(ctx, `"${slide.subtitle}"`, 100, titleNextY + 30, 880, 38) + 30;
        }
        ctx.fillStyle = "#3F3F46";
        ctx.font = "normal 32px Georgia, serif";
        wrapText(ctx, slide.body, 100, titleNextY + 70, 880, 50);
        ctx.restore();
      }
    } else {
      const titleY = isCover ? 480 : 380;
      let titleNextY = drawTitleWithHighlights(ctx, slide.title, 100, titleY, 880, 75, "#18181B", accentColor);
      ctx.fillStyle = accentColor;
      ctx.fillRect(100, titleNextY + 15, 120, 6);
      ctx.fillStyle = "#3F3F46";
      ctx.font = "normal 32px Georgia, serif";
      wrapText(ctx, slide.body, 100, titleNextY + 70, 880, 50);
    }

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

    // Slide header
    if (isContent && slide.badge) {
      drawSlideBadgeToCanvas(ctx, slide.badge, 80, 105, "#FFFFFF");
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      drawRoundedRect(ctx, 840, 80, 160, 50, 25);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${slideIndex + 1} / ${totalSlides}`, 920, 112);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      drawRoundedRect(ctx, 80, 80, 160, 50, 25);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(isCover ? "New Post" : `${slideIndex + 1} / ${totalSlides}`, 115, 112);
    }

    // Title & Content
    if (isContent) {
      let titleNextY = drawTitleWithHighlights(ctx, slide.title, 80, 180, 920, 75, "#FFFFFF", accentColor);
      if (layout === "metrics") {
        drawSlideMetricsToCanvas(ctx, metrics, slide.subtitle, slide.body, slide.footer, titleNextY + 30, 920, accentColor, "gradient_flow", true);
      } else if (layout === "points") {
        drawSlidePointsToCanvas(ctx, points, slide.subtitle, slide.footer, titleNextY + 30, 920, accentColor, "gradient_flow", true);
      } else {
        ctx.save();
        if (slide.subtitle) {
          ctx.fillStyle = accentColor;
          ctx.fillRect(60, titleNextY + 10, 4, 32);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "italic 28px system-ui, sans-serif";
          titleNextY = wrapText(ctx, `"${slide.subtitle}"`, 80, titleNextY + 30, 920, 38) + 30;
        }
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "normal 32px system-ui, sans-serif";
        wrapText(ctx, slide.body, 80, titleNextY + 30, 920, 48);
        ctx.restore();
      }
    } else {
      const titleY = isCover ? 480 : 380;
      const titleNextY = drawTitleWithHighlights(ctx, slide.title, 80, titleY, 920, 75, "#FFFFFF", accentColor);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "normal 32px system-ui, sans-serif";
      wrapText(ctx, slide.body, 80, titleNextY + 30, 920, 48);
    }

    if (isCover) {
      for (let d = 0; d < totalSlides; d++) {
        ctx.fillStyle = d === 0 ? "#FFFFFF" : "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(80 + d * 30, 980, d === 0 ? 10 : 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (templateId === "split_pro") {
    // Left panel
    if (bgImgElement) {
      ctx.drawImage(bgImgElement, 0, 0, 1080, 1080);
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0, 0, 432, 1080);
      ctx.globalAlpha = 1.0;
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

    // Right panel header
    ctx.fillStyle = accentColor;
    if (isContent && slide.badge) {
      drawSlideBadgeToCanvas(ctx, slide.badge, 500, 105, accentColor);
      ctx.save();
      drawRoundedRect(ctx, 850, 80, 150, 48, 24);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${slideIndex + 1}/${totalSlides}`, 925, 111);
      ctx.restore();
    } else {
      drawRoundedRect(ctx, 500, 80, 150, 48, 24);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillText(isCover ? "Swipe →" : isCta ? "Follow" : `Step ${slideIndex}`, 530, 111);
    }

    // Right panel Title & Content
    if (isContent) {
      let titleNextY = drawTitleWithHighlights(ctx, slide.title, 500, 180, 500, 70, "#18181B", accentColor);
      if (layout === "metrics") {
        drawSlideMetricsToCanvas(ctx, metrics, slide.subtitle, slide.body, slide.footer, titleNextY + 30, 500, accentColor, "split_pro", false);
      } else if (layout === "points") {
        drawSlidePointsToCanvas(ctx, points, slide.subtitle, slide.footer, titleNextY + 30, 500, accentColor, "split_pro", false);
      } else {
        ctx.save();
        if (slide.subtitle) {
          ctx.fillStyle = accentColor;
          ctx.fillRect(480, titleNextY + 10, 4, 32);
          ctx.fillStyle = "#4B5563";
          ctx.font = "italic 28px system-ui, sans-serif";
          titleNextY = wrapText(ctx, `"${slide.subtitle}"`, 500, titleNextY + 30, 500, 38) + 30;
        }
        ctx.fillStyle = "#71717A";
        ctx.font = "normal 30px system-ui, sans-serif";
        wrapText(ctx, slide.body, 500, titleNextY + 30, 500, 46);
        ctx.restore();
      }
    } else {
      const titleY = isCover ? 480 : 380;
      const titleNextY = drawTitleWithHighlights(ctx, slide.title, 500, titleY, 500, 70, "#18181B", accentColor);
      ctx.fillStyle = "#71717A";
      ctx.font = "normal 30px system-ui, sans-serif";
      wrapText(ctx, slide.body, 500, titleNextY + 30, 500, 46);
    }

    // Page indicators
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

    // Slide header
    if (isContent && slide.badge) {
      drawSlideBadgeToCanvas(ctx, slide.badge, 130, 145, accentColor);
      ctx.save();
      ctx.fillStyle = accentColor;
      drawRoundedRect(ctx, 780, 120, 160, 50, 25);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${slideIndex + 1} / ${totalSlides}`, 860, 152);
      ctx.restore();
    } else {
      ctx.fillStyle = accentColor;
      drawRoundedRect(ctx, 120, 120, 160, 50, 25);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(isCover ? "New" : `${slideIndex + 1} of ${totalSlides}`, 155, 152);
    }

    // Title & Content
    if (isContent) {
      let titleNextY = drawTitleWithHighlights(ctx, slide.title, 130, 210, 820, 75, "#FFFFFF", accentColor);
      if (layout === "metrics") {
        drawSlideMetricsToCanvas(ctx, metrics, slide.subtitle, slide.body, slide.footer, titleNextY + 30, 820, accentColor, "frosted_card", true);
      } else if (layout === "points") {
        drawSlidePointsToCanvas(ctx, points, slide.subtitle, slide.footer, titleNextY + 30, 820, accentColor, "frosted_card", true);
      } else {
        ctx.save();
        if (slide.subtitle) {
          ctx.fillStyle = accentColor;
          ctx.fillRect(110, titleNextY + 10, 4, 32);
          ctx.fillStyle = "#E2E8F0";
          ctx.font = "italic 28px system-ui, sans-serif";
          titleNextY = wrapText(ctx, `"${slide.subtitle}"`, 130, titleNextY + 30, 820, 38) + 30;
        }
        ctx.fillStyle = "#E2E8F0";
        ctx.font = "normal 32px system-ui, sans-serif";
        wrapText(ctx, slide.body, 130, titleNextY + 30, 820, 48);
        ctx.restore();
      }
    } else {
      const titleY = isCover ? 480 : 380;
      const titleNextY = drawTitleWithHighlights(ctx, slide.title, 130, titleY, 820, 75, "#FFFFFF", accentColor);
      ctx.fillStyle = "#E2E8F0";
      ctx.font = "normal 32px system-ui, sans-serif";
      wrapText(ctx, slide.body, 130, titleNextY + 30, 820, 48);
    }
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

// ─── SlidePointsRenderer Component ──────────────────────────────────────────

function SlidePointsRenderer({
  slide,
  accentColor,
  templateId,
  compact = false,
  isDark = true
}: {
  slide: Slide;
  accentColor: string;
  templateId: string;
  compact?: boolean;
  isDark?: boolean;
}) {
  const isContent = slide.type !== "cover" && slide.type !== "cta";
  const points = isContent ? getSlidePoints(slide) : [];
  const metrics = isContent ? getSlideMetrics(slide) : [];
  const layout = slide.layout || (metrics.length > 0 ? "metrics" : points.length > 0 ? "points" : "paragraph");

  if (!isContent) {
    return null;
  }

  const renderSubtitle = () => {
    if (!slide.subtitle) return null;
    return (
      <div className="flex items-stretch gap-2 mb-2 mt-1">
        <div className="w-0.5 rounded-full flex-shrink-0" style={{ background: accentColor }} />
        <p className={`italic font-medium ${compact ? "text-[9px]" : "text-xs"} ${
          isDark ? "text-zinc-300" : "text-zinc-500"
        }`}>
          "{slide.subtitle}"
        </p>
      </div>
    );
  };

  const renderFooter = () => {
    if (!slide.footer) return null;
    return (
      <div className={`flex items-center gap-2 rounded-lg border p-2 mt-auto ${
        isDark 
          ? "border-green-500/20 bg-green-500/10 text-zinc-300" 
          : "border-green-200 bg-green-50/50 text-stone-700"
      } ${compact ? "text-[8px] py-1" : "text-xs"}`}>
        <span className="text-green-500 font-bold flex-shrink-0">✓</span>
        <p className="flex-1 truncate font-medium">{slide.footer}</p>
      </div>
    );
  };

  if (layout === "metrics" && metrics.length > 0) {
    return (
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {renderSubtitle()}
          {slide.body && (
            <p className={`leading-relaxed ${compact ? "text-[8px] mb-2" : "text-xs mb-3"} ${
              isDark ? "text-zinc-400" : "text-zinc-600"
            }`}>
              {slide.body}
            </p>
          )}
          <div className={`flex flex-col ${compact ? "gap-1 my-1" : "gap-3 my-3"}`}>
            {metrics.map((m, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className={`font-black ${compact ? "text-sm" : "text-2xl"}`} style={{ color: accentColor }}>
                  {m.value}
                </div>
                {m.label && (
                  <div className={`font-bold leading-tight ${compact ? "text-[8px]" : "text-[11px]"} ${isDark ? "text-white" : "text-zinc-855"}`}>
                    {m.label}
                  </div>
                )}
                <p className={`leading-normal ${compact ? "text-[7.5px]" : "text-[10px]"} ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  {m.text}
                </p>
                {i < metrics.length - 1 && (
                  <div className="w-1/3 my-0.5 border-b opacity-25" style={{ borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }} />
                )}
              </div>
            ))}
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  if (layout === "points" && points.length > 0) {
    return (
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {renderSubtitle()}
          <div className={`flex flex-col ${compact ? "gap-1 my-1" : "gap-3 my-3"}`}>
            {points.map((pt, i) => {
              if (templateId === "minimal_clean") {
                return (
                  <div key={i} className={`border-t border-stone-200 ${compact ? "pt-1" : "pt-2"} relative pl-7`}>
                    <div className="absolute left-0 top-2 font-mono text-[9px] font-bold text-stone-400">
                      0{i+1}
                    </div>
                    <h4 className={`font-bold text-stone-900 leading-snug ${compact ? "text-[9px]" : "text-xs"}`}>
                      {pt.title}
                    </h4>
                    <p className={`text-stone-600 leading-normal ${compact ? "text-[8px]" : "text-[11px]"}`}>
                      {pt.text}
                    </p>
                  </div>
                );
              }
              
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg p-2 relative pl-8 border ${
                    isDark 
                      ? "bg-white/[0.03] border-white/5" 
                      : "bg-black/[0.02] border-black/5"
                  }`}
                >
                  <div className="absolute left-2.5 top-2.5 font-mono text-[9px] font-semibold opacity-60" style={{ color: accentColor }}>
                    0{i+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold leading-snug ${compact ? "text-[9px]" : "text-xs"} ${
                      isDark ? "text-white" : "text-zinc-900"
                    }`}>
                      {pt.title}
                    </h4>
                    <p className={`leading-normal ${compact ? "text-[8px]" : "text-[11px]"} ${
                      isDark ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {pt.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between h-full">
      <div>
        {renderSubtitle()}
        <p className={`leading-relaxed ${
          templateId === "minimal_clean" ? "text-zinc-700" :
          templateId === "gradient_flow" ? "text-white/90" :
          templateId === "split_pro" ? "text-zinc-650" :
          templateId === "frosted_card" ? "text-slate-200" : "text-zinc-350"
        } ${compact ? "text-[9px] mt-1" : "text-sm mt-3"}`}>
          {slide.body}
        </p>
      </div>
      {renderFooter()}
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
  backgroundImage,
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
  backgroundImage?: string;
}) {
  const isCover = slide.type === "cover";
  const isCta = slide.type === "cta";
  const isContent = !isCover && !isCta;
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
          {isContent && slide.badge ? (
            <div className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide`} style={{ color: accentColor, borderColor: `${accentColor}50` }}>
              {slide.badge}
            </div>
          ) : (
            <div />
          )}
          <div className={`${compact ? "text-[9px]" : "text-xs"} font-bold uppercase tracking-widest`} style={{ color: accentColor }}>
            {isCover ? "●●●●●" : `${slideIndex + 1} / ${totalSlides}`}
          </div>
        </div>
        <div className="relative z-10 mt-auto flex-1 flex flex-col justify-end">
          <h2
            className={`font-black leading-tight text-white ${compact ? "text-sm mb-1" : "text-2xl mb-3"}`}
            style={{ textShadow: `0 0 30px ${accentColor}40` }}
          >
            {renderHighlightedText(slide.title, accentColor)}
          </h2>
          <SlidePointsRenderer slide={slide} accentColor={accentColor} templateId={templateId} compact={compact} isDark={true} />
          {showAuthor && (
            <AuthorStrip name={authorName} picture={authorPicture} accentColor={accentColor} dark compact={compact} isCta={isCta} linkedinUrl={authorLinkedinUrl} />
          )}
        </div>
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
            {isContent && slide.badge ? (
              <div className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wide`} style={{ color: accentColor, borderColor: `${accentColor}50` }}>
                {slide.badge}
              </div>
            ) : (
              <div />
            )}
            <div className={`font-mono ${compact ? "text-[8px]" : "text-xs"} text-zinc-400 uppercase tracking-widest`}>
              {isCover ? "Swipe →" : `0${slideIndex + 1}`}
            </div>
          </div>
          <div className="mt-auto flex-1 flex flex-col justify-end">
            <h2
              className={`font-bold leading-tight ${compact ? "text-sm mb-1" : "text-2xl mb-4"}`}
              style={{ color: "#18181B", fontFamily: "Georgia, serif" }}
            >
              {renderHighlightedText(slide.title, accentColor)}
            </h2>
            <SlidePointsRenderer slide={slide} accentColor={accentColor} templateId={templateId} compact={compact} isDark={false} />
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
            {isContent && slide.badge ? (
              <div className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide text-white border-white/30`}>
                {slide.badge}
              </div>
            ) : (
              <div />
            )}
            <div
              className={`${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} rounded-full font-bold text-white`}
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
            >
              {isCover ? "New Post" : `${slideIndex + 1}/${totalSlides}`}
            </div>
          </div>
          <div className="mt-auto flex-1 flex flex-col justify-end">
            <h2 className={`font-black text-white leading-tight ${compact ? "text-sm mb-1" : "text-2xl mb-3"}`}>
              {renderHighlightedText(slide.title, accentColor)}
            </h2>
            <SlidePointsRenderer slide={slide} accentColor={accentColor} templateId={templateId} compact={compact} isDark={true} />
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
          <div className="flex justify-between items-start">
            {isContent && slide.badge ? (
              <div className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wide`} style={{ color: accentColor, borderColor: `${accentColor}50` }}>
                {slide.badge}
              </div>
            ) : (
              <div />
            )}
            <div
              className={`${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} rounded-full font-bold w-fit`}
              style={{ background: `${accentColor}18`, color: accentColor }}
            >
              {isCover ? "Swipe →" : isCta ? "Follow" : `Step ${slideIndex}`}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center my-2">
            <h2 className={`font-black leading-tight text-zinc-900 ${compact ? "text-[11px] mb-1" : "text-xl mb-3"}`}>
              {renderHighlightedText(slide.title, accentColor)}
            </h2>
            <SlidePointsRenderer slide={slide} accentColor={accentColor} templateId={templateId} compact={compact} isDark={false} />
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
          {isContent && slide.badge ? (
            <div className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide text-white border-white/20`}>
              {slide.badge}
            </div>
          ) : (
            <div />
          )}
          <div
            className={`rounded-full ${compact ? "text-[8px] px-2 py-0.5" : "text-xs px-3 py-1"} font-bold`}
            style={{ background: accentColor, color: "#fff" }}
          >
            {isCover ? "New" : `${slideIndex + 1} of ${totalSlides}`}
          </div>
        </div>
        <div className="mt-auto flex-1 flex flex-col justify-end">
          <h2
            className={`font-black leading-tight ${compact ? "text-sm mb-1" : "text-xl mb-3"}`}
            style={{ color: "#FFFFFF" }}
          >
            {renderHighlightedText(slide.title, accentColor)}
          </h2>
          <SlidePointsRenderer slide={slide} accentColor={accentColor} templateId={templateId} compact={compact} isDark={true} />
          {showAuthor && (
            <AuthorStrip name={authorName} picture={authorPicture} accentColor={accentColor} dark compact={compact} isCta={isCta} linkedinUrl={authorLinkedinUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

// Custom Markdown-to-HTML parser for long-form LinkedIn Articles
function renderMarkdownToHtml(text: string) {
  if (!text) return "";
  
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        return `<h1 class="text-xl font-black text-zinc-900 dark:text-white mt-4 mb-2">${trimmed.substring(2)}</h1>`;
      }
      if (trimmed.startsWith("## ")) {
        return `<h2 class="text-lg font-extrabold text-zinc-800 dark:text-zinc-100 mt-4 mb-2">${trimmed.substring(3)}</h2>`;
      }
      if (trimmed.startsWith("### ")) {
        return `<h3 class="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-3 mb-1.5">${trimmed.substring(4)}</h3>`;
      }
      if (trimmed.startsWith("> ")) {
        return `<blockquote class="border-l-4 border-zinc-300 dark:border-zinc-700 pl-3 italic text-zinc-650 dark:text-zinc-400 my-2">${trimmed.substring(2)}</blockquote>`;
      }
      if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
        return `<li class="ml-4 list-disc text-zinc-800 dark:text-zinc-250 my-1">${trimmed.substring(2)}</li>`;
      }
      if (trimmed === "") {
        return `<div class="h-2"></div>`;
      }
      
      let html = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-blue-500 underline">$1</a>');
      
      return `<p class="my-1.5 leading-relaxed text-zinc-800 dark:text-zinc-250">${html}</p>`;
    })
    .join("");
}

interface ArticleSection {
  index: number;
  heading: string;
  level: number;
  content: string;
}

function parseArticleSections(content: string): ArticleSection[] {
  if (!content) return [];
  
  const lines = content.split("\n");
  const sections: ArticleSection[] = [];
  let currentSection: ArticleSection | null = null;
  let sectionIndex = 0;
  
  const pushCurrent = () => {
    if (currentSection) {
      currentSection.content = currentSection.content.trim();
      sections.push(currentSection);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith("# ")) {
      pushCurrent();
      currentSection = {
        index: sectionIndex++,
        heading: trimmed.substring(2),
        level: 1,
        content: ""
      };
    } else if (trimmed.startsWith("## ")) {
      pushCurrent();
      currentSection = {
        index: sectionIndex++,
        heading: trimmed.substring(3),
        level: 2,
        content: ""
      };
    } else if (trimmed.startsWith("### ")) {
      pushCurrent();
      currentSection = {
        index: sectionIndex++,
        heading: trimmed.substring(4),
        level: 3,
        content: ""
      };
    } else {
      if (!currentSection) {
        currentSection = {
          index: sectionIndex++,
          heading: "Introduction",
          level: 2,
          content: ""
        };
      }
      currentSection.content += line + "\n";
    }
  }
  pushCurrent();
  return sections;
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
  const [seriesPosts, setSeriesPosts] = useState<any[]>([]);
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

  // Comments & Engagement States
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likesCount, setLikesCount] = useState<number | null>(null);
  const [commentsCount, setCommentsCount] = useState<number | null>(null);
  const [refreshingComments, setRefreshingComments] = useState(false);
  const [commentReplies, setCommentReplies] = useState<Record<string, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string[]>>({});
  const [loadingDrafts, setLoadingDrafts] = useState<Record<string, boolean>>({});
  const [voiceRecordingCommentId, setVoiceRecordingCommentId] = useState<string | null>(null);
  const [voiceTranscribingCommentId, setVoiceTranscribingCommentId] = useState<string | null>(null);
  const [postingReply, setPostingReply] = useState<Record<string, boolean>>({});
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Carousel Specific States
  const [isCarousel, setIsCarousel] = useState(false);
  const [carouselData, setCarouselData] = useState<any>(null);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSlideImage, setEditSlideImage] = useState("");
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("bold_impact");
  const [accentColor, setAccentColor] = useState("#3B82F6");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showAuthor, setShowAuthor] = useState(true); // Author branding toggle for carousel slides
  const [promoPosts, setPromoPosts] = useState<any[]>([]);
  const [generatingPromo, setGeneratingPromo] = useState(false);
  const [promoStyleType, setPromoStyleType] = useState<"expert" | "own">("expert");
  const [selectedPromoStyleId, setSelectedPromoStyleId] = useState("fomo_style");

  const [activeImageSelectSection, setActiveImageSelectSection] = useState<number | null>(null);
  const [sectionUnsplashQuery, setSectionUnsplashQuery] = useState("");
  const [sectionUnsplashResults, setSectionUnsplashResults] = useState<any[]>([]);
  const [searchingSectionUnsplash, setSearchingSectionUnsplash] = useState(false);
  const [sectionAiPrompt, setSectionAiPrompt] = useState("");
  const [generatingSectionAi, setGeneratingSectionAi] = useState(false);
  const [sectionActiveTab, setSectionActiveTab] = useState<Record<number, "search" | "ai" | "upload">>({});
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [editingSectionText, setEditingSectionText] = useState("");

  const [regenStyleType, setRegenStyleType] = useState<"expert" | "own">("expert");
  const [regenStyleId, setRegenStyleId] = useState("");
  const [activeImageSelectPost, setActiveImageSelectPost] = useState(false);
  const [expertStyles, setExpertStyles] = useState<any[]>([]);
  const [customStyles, setCustomStyles] = useState<any[]>([]);

  // Voice Recording & Document Upload for Feedback
  const [isRecordingFeedback, setIsRecordingFeedback] = useState(false);
  const [isTranscribingFeedback, setIsTranscribingFeedback] = useState(false);
  const [feedbackRecordingDuration, setFeedbackRecordingDuration] = useState(0);
  const [feedbackMediaRecorder, setFeedbackMediaRecorder] = useState<MediaRecorder | null>(null);
  const [attachedDocText, setAttachedDocText] = useState("");
  const [attachedDocName, setAttachedDocName] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Timer for feedback voice recording
  useEffect(() => {
    let interval: any;
    if (isRecordingFeedback) {
      interval = setInterval(() => {
        setFeedbackRecordingDuration((prev) => {
          if (prev >= 180) { // Limit to 3 mins
            stopFeedbackRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setFeedbackRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingFeedback]);

  const startFeedbackRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        setIsTranscribingFeedback(true);

        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "feedback_audio.webm");
          formData.append("duration", feedbackRecordingDuration.toString());

          // Step 1: Submit audio (returns transcript_id)
          const res = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: formData,
          });
          const submitData = await res.json();
          if (!submitData.transcript_id) {
            throw new Error(submitData.error || "Failed to submit transcription");
          }

          const { transcript_id, user_id, industry, keywords, duration_seconds } = submitData;
          const keywordsStr = Array.isArray(keywords) ? keywords.join(",") : "";

          // Step 2: Poll status
          const pollUrl = `/api/voice/transcribe/status?id=${transcript_id}&user_id=${user_id}&duration=${duration_seconds}&industry=${encodeURIComponent(industry || "")}&keywords=${encodeURIComponent(keywordsStr)}`;
          
          const maxAttempts = 40; // 80s max
          let completedTranscript = "";

          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const pollRes = await fetch(pollUrl);
            const pollData = await pollRes.json();

            if (pollData.status === "completed" && pollData.corrected_transcript) {
              completedTranscript = pollData.corrected_transcript;
              break;
            } else if (pollData.status === "error") {
              throw new Error(pollData.error || "Transcription failed");
            }
          }

          if (completedTranscript) {
            setFeedback((prev) => prev ? `${prev}\n${completedTranscript}` : completedTranscript);
          } else {
            throw new Error("Transcription timed out.");
          }
        } catch (err: any) {
          console.error("Feedback voice processing failed:", err);
          alert("Voice processing failed: " + (err.message || "Please try typing your feedback."));
        } finally {
          setIsTranscribingFeedback(false);
        }
      };

      setFeedbackMediaRecorder(recorder);
      setIsRecordingFeedback(true);
      setFeedbackRecordingDuration(0);
      recorder.start();
    } catch (err) {
      console.error("Failed to access microphone:", err);
      alert("Microphone access denied or not supported.");
    }
  };

  const stopFeedbackRecording = () => {
    if (feedbackMediaRecorder && feedbackMediaRecorder.state !== "inactive") {
      feedbackMediaRecorder.stop();
      feedbackMediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecordingFeedback(false);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Max 10MB allowed.");
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/content/extract-text", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.text) {
        setAttachedDocText(data.text);
        setAttachedDocName(file.name);
      } else {
        throw new Error(data.error || "Failed to extract text from document");
      }
    } catch (err: any) {
      console.error("Document parsing error:", err);
      alert("Failed to parse document: " + (err.message || "Please copy and paste the content manually."));
    } finally {
      setUploadingDoc(false);
    }
  };

  useEffect(() => {
    async function loadStyles() {
      try {
        const expRes = await fetch("/api/style/experts");
        const expData = await expRes.json();
        if (expData.success) {
          setExpertStyles(expData.experts || []);
        }

        const custRes = await fetch("/api/style/custom");
        const custData = await custRes.json();
        if (custData.success) {
          setCustomStyles(custData.customStyles || []);
        }
      } catch (err) {
        console.error("Failed to load styles:", err);
      }
    }
    loadStyles();
  }, []);

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
          setSeriesPosts(data.series || []);
          setRegenStyleType(data.post.style_type || "expert");
          setRegenStyleId(data.post.style_id || "fomo_style");

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

          // Fetch promo posts
          try {
            const postsRes = await fetch("/api/posts");
            const postsData = await postsRes.json();
            if (postsData.success) {
              const promos = postsData.posts.filter((p: any) => p.parent_post_id === id);
              setPromoPosts(promos);
            }
          } catch (promoErr) {
            console.error("Failed to fetch promo posts:", promoErr);
          }
        }

        // Load connected LinkedIn account
        const [accRes, listRes] = await Promise.all([
          fetch("/api/linkedin/scraping-status"),
          fetch("/api/linkedin/accounts")
        ]);
        if (accRes.ok) {
          const accData = await accRes.json();
          if (accData.status && accData.status !== "disconnected") {
            setLinkedAccount(accData);
          }
        }
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.success) {
            setAccountsList(listData.accounts || []);
          }
        }
      } catch (err) {
        console.error("Failed to load approval package:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPostData();
  }, [id]);

  // Automatically trigger promotional post generation in the background if none exists yet for the article
  useEffect(() => {
    if (post && post.content_type === "article" && post.status !== "published" && promoPosts.length === 0 && !generatingPromo) {
      const autoGeneratePromo = async () => {
        setGeneratingPromo(true);
        try {
          const res = await fetch("/api/content/generate-promo-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parent_post_id: id,
              style_type: promoStyleType,
              style_id: selectedPromoStyleId,
            }),
          });
          const data = await res.json();
          if (data.success) {
            const postsRes = await fetch("/api/posts");
            const postsData = await postsRes.json();
            if (postsData.success) {
              const promos = postsData.posts.filter((p: any) => p.parent_post_id === id);
              setPromoPosts(promos);
            }
          }
        } catch (e) {
          console.error("Auto promo generation failed:", e);
        } finally {
          setGeneratingPromo(false);
        }
      };
      autoGeneratePromo();
    }
  }, [post?.id, post?.content_type, post?.status, promoPosts.length]);

  const generatePromoPost = async () => {
    setGeneratingPromo(true);
    try {
      const res = await fetch("/api/content/generate-promo-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_post_id: id,
          style_type: promoStyleType,
          style_id: selectedPromoStyleId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Promotional post draft generated successfully!");
        // Reload promo posts
        const postsRes = await fetch("/api/posts");
        const postsData = await postsRes.json();
        if (postsData.success) {
          const promos = postsData.posts.filter((p: any) => p.parent_post_id === id);
          setPromoPosts(promos);
        }
      } else {
        alert("Failed to generate promotional post: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error generating promo post: " + e.message);
    } finally {
      setGeneratingPromo(false);
    }
  };

  const handlePublishPromoPost = async (promoId: string) => {
    try {
      const pubRes = await fetch(`/api/posts/${promoId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backend: "waterfall" }),
      });
      const pubData = await pubRes.json();
      
      if (pubRes.status === 403 && pubData.limit_hit) {
        alert(`${pubData.title}: ${pubData.body}`);
      } else if (pubData.success) {
        alert(`Successfully published promotional post to LinkedIn!`);
        // Reload promo posts
        const postsRes = await fetch("/api/posts");
        const postsData = await postsRes.json();
        if (postsData.success) {
          const promos = postsData.posts.filter((p: any) => p.parent_post_id === id);
          setPromoPosts(promos);
        }
      } else if (pubData.pending_review) {
        alert(`Successfully copied promo post draft to clipboard! ${pubData.message}`);
        navigator.clipboard.writeText(pubData.post_content + "\n\n" + pubData.hashtags.map((h: string) => `#${h}`).join(" "));
        window.open(pubData.redirect_url || "https://www.linkedin.com/", "_blank");
        // Reload promo posts
        const postsRes = await fetch("/api/posts");
        const postsData = await postsRes.json();
        if (postsData.success) {
          const promos = postsData.posts.filter((p: any) => p.parent_post_id === id);
          setPromoPosts(promos);
        }
      } else {
        alert("Publish failed: " + (pubData.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error publishing promo post: " + e.message);
    }
  };

  const handleSectionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, secIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideoFile = file.type.startsWith("video/");
    const maxSize = isVideoFile ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File is too large. Max ${isVideoFile ? "15MB" : "5MB"} allowed.`);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      await attachSectionImage(base64Data, "upload", secIndex);
      setActiveImageSelectSection(null);
    };
    reader.readAsDataURL(file);
  };

  const attachSectionImage = async (url: string, sourceType: string, secIndex: number, promptUsed = "") => {
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: url,
          source_type: sourceType,
          prompt_used: promptUsed || null,
          section_index: secIndex === -1 ? null : secIndex
        }),
      });
      if (res.ok) {
        const postRes = await fetch(`/api/posts/${id}`);
        if (postRes.ok) {
          const postData = await postRes.json();
          setImages(postData.images || []);
        }
      } else {
        alert("Failed to attach image to section");
      }
    } catch (err: any) {
      alert("Error attaching image: " + err.message);
    }
  };

  const handleSectionImageSearch = async (secIndex: number, queryStr: string) => {
    if (!queryStr.trim()) return;
    setSearchingSectionUnsplash(true);
    try {
      const res = await fetch(`/api/images/search?query=${encodeURIComponent(queryStr)}`);
      const data = await res.json();
      if (data.success) {
        setSectionUnsplashResults(data.images || data.results || []);
      } else {
        alert("Failed to find images: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error searching images: " + e.message);
    } finally {
      setSearchingSectionUnsplash(false);
    }
  };

  const handleSectionImageGenerate = async (secIndex: number, promptStr: string) => {
    if (!promptStr.trim()) return;
    setGeneratingSectionAi(true);
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: id,
          post_content: postContent,
          prompt: promptStr,
        }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        await attachSectionImage(data.image.url, "ai", secIndex, promptStr);
        setActiveImageSelectSection(null);
      } else {
        alert("Generation failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error generating image: " + e.message);
    } finally {
      setGeneratingSectionAi(false);
    }
  };

  const renderSectionImageSelector = (secIndex: number) => {
    const activeTab = sectionActiveTab[secIndex] || "search";
    const setActiveTab = (tab: "search" | "ai" | "upload") => {
      setSectionActiveTab(prev => ({ ...prev, [secIndex]: tab }));
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("search")}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border-none cursor-pointer ${activeTab === "search" ? "bg-zinc-800 text-cyan-400" : "bg-transparent text-zinc-500"}`}
            >
              Unsplash
            </button>
            <button
              onClick={() => {
                setActiveTab("ai");
                if (!sectionAiPrompt) {
                  const seed = secIndex === -1 
                    ? (post?.post_title || postContent?.split("\n")[0]?.substring(0, 60) || "business concept")
                    : (parseArticleSections(postContent).find(s => s.index === secIndex)?.heading || "SaaS concept");
                  setSectionAiPrompt(`Professional detailed illustration for: ${seed}`);
                }
              }}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border-none cursor-pointer ${activeTab === "ai" ? "bg-zinc-800 text-cyan-400" : "bg-transparent text-zinc-500"}`}
            >
              AI Generate
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border-none cursor-pointer ${activeTab === "upload" ? "bg-zinc-800 text-cyan-400" : "bg-transparent text-zinc-500"}`}
            >
              Upload
            </button>
          </div>
          <button
            onClick={() => setActiveImageSelectSection(null)}
            className="text-[10px] font-bold text-zinc-500 hover:text-white bg-transparent border-none cursor-pointer"
          >
            Close
          </button>
        </div>

        {activeTab === "search" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={sectionUnsplashQuery}
                onChange={(e) => setSectionUnsplashQuery(e.target.value)}
                placeholder="Search keywords..."
                className="flex-1 bg-zinc-900 border border-zinc-850 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => handleSectionImageSearch(secIndex, sectionUnsplashQuery)}
                disabled={searchingSectionUnsplash}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-zinc-850 text-xs font-bold text-white rounded-lg border-none cursor-pointer"
              >
                {searchingSectionUnsplash ? "Searching..." : "Search"}
              </button>
            </div>
            
            {sectionUnsplashResults.length > 0 && (
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                {sectionUnsplashResults.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => {
                      attachSectionImage(img.url, "search", secIndex);
                      setActiveImageSelectSection(null);
                      setSectionUnsplashResults([]);
                    }}
                    className="relative aspect-video rounded-lg overflow-hidden cursor-pointer border border-zinc-850 hover:border-cyan-500"
                  >
                    <img src={img.url} alt="Search result" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "ai" && (
          <div className="space-y-2">
            <textarea
              value={sectionAiPrompt}
              onChange={(e) => setSectionAiPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500 resize-y min-h-[60px]"
            />
            <button
              onClick={() => handleSectionImageGenerate(secIndex, sectionAiPrompt)}
              disabled={generatingSectionAi}
              className="w-full py-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 disabled:from-zinc-850 disabled:to-zinc-850 text-xs font-black text-white rounded-lg border-none cursor-pointer flex items-center justify-center gap-1.5"
            >
              {generatingSectionAi ? (
                <>
                  <div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Generate Image
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === "upload" && (
          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center border border-dashed border-zinc-850 rounded-lg p-4 bg-zinc-950/20 text-center cursor-pointer hover:border-cyan-500/40">
              <Upload className="w-5 h-5 text-cyan-400 mb-1" />
              <span className="text-[10px] font-bold text-zinc-300">Choose custom image or video file</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => handleSectionImageUpload(e, secIndex)}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (post?.id && post?.status === "published") {
      fetchComments();
    }
  }, [post?.id, post?.status]);

  const fetchComments = async (options?: { refresh?: boolean }) => {
    const isRefresh = options?.refresh === true;
    if (isRefresh) {
      setRefreshingComments(true);
    } else {
      setLoadingComments(true);
    }
    try {
      const url = `/api/posts/${id}/comments${isRefresh ? "?refresh=true" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setComments(data.comments || []);
        setLikesCount(data.likes_count ?? null);
        setCommentsCount(data.comments_count ?? null);

        // Auto-load pre-generated drafts
        const draftsMap: Record<string, string[]> = {};
        data.comments.forEach((c: any) => {
          if (c.reply_draft) {
            try {
              draftsMap[c.id] = typeof c.reply_draft === "string" ? JSON.parse(c.reply_draft) : c.reply_draft;
            } catch (e) {
              console.warn("Failed to parse pre-generated draft:", e);
            }
          }
        });
        setCommentDrafts((prev) => ({ ...prev, ...draftsMap }));
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoadingComments(false);
      setRefreshingComments(false);
    }
  };

  const handleGenerateDrafts = async (comment: any) => {
    const cid = comment.id;
    setLoadingDrafts((prev) => ({ ...prev, [cid]: true }));
    try {
      const res = await fetch("/api/comments/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_content: postContent,
          comment_text: comment.comment_text,
          thread_history: comment.thread_history || []
        })
      });
      const data = await res.json();
      if (data.success && data.options) {
        setCommentDrafts((prev) => ({ ...prev, [cid]: data.options }));
      }
    } catch (err) {
      console.error("Failed to generate drafts:", err);
    } finally {
      setLoadingDrafts((prev) => ({ ...prev, [cid]: false }));
    }
  };

  const startVoiceRecording = async (cid: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        setVoiceTranscribingCommentId(cid);
        
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "comment_reply.webm");
          
          const transcribeRes = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: formData,
          });
          const transcribeData = await transcribeRes.json();
          
          if (transcribeData.success && transcribeData.transcript) {
            const rawTranscript = transcribeData.transcript;
            const targetComment = comments.find(c => c.id === cid);
            
            const rewriteRes = await fetch("/api/comments/rewrite-reply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transcript: rawTranscript,
                post_content: postContent,
                comment_text: targetComment?.comment_text,
                thread_history: targetComment?.thread_history || []
              })
            });
            const rewriteData = await rewriteRes.json();
            
            if (rewriteData.success && rewriteData.rewritten_reply) {
              setCommentReplies((prev) => ({ ...prev, [cid]: rewriteData.rewritten_reply }));
            }
          }
        } catch (err) {
          console.error("Voice reply processing failed:", err);
          alert("Voice processing failed. Please try typing your reply.");
        } finally {
          setVoiceTranscribingCommentId(null);
        }
      };

      setMediaRecorder(recorder);
      setVoiceRecordingCommentId(cid);
      recorder.start();
    } catch (err) {
      console.error("Failed to access microphone:", err);
      alert("Microphone access denied or not supported.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setVoiceRecordingCommentId(null);
  };

  const handlePostReply = async (commentId: string) => {
    const replyText = commentReplies[commentId]?.trim();
    if (!replyText) {
      alert("Please enter or select a reply draft first.");
      return;
    }

    setPostingReply((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment_id: commentId,
          reply_text: replyText
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchComments();
        alert("Reply successfully posted!");
      } else {
        alert("Failed to post reply: " + data.error);
      }
    } catch (err) {
      console.error("Failed to post reply:", err);
    } finally {
      setPostingReply((prev) => ({ ...prev, [commentId]: false }));
    }
  };

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
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_content: content, hashtags: tags }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.post) {
          setPost(data.post);
          // Refresh revisions list
          const revRes = await fetch(`/api/posts/${id}`);
          if (revRes.ok) {
            const revData = await revRes.json();
            setRevisions(revData.revisions || []);
          }
        }
      }
    } catch (e) {
      console.error("Failed to save changes:", e);
    }
  };

  const handleConvertToCarousel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${id}/convert-to-carousel`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.post) {
        setPost(data.post);
        const rawContent = data.post.post_content || "";
        setPostContent(rawContent);
        
        // Parse carousel data
        try {
          const parsed = JSON.parse(rawContent);
          setIsCarousel(true);
          setCarouselData(parsed);
          setSelectedTemplate(parsed.templateId || "bold_impact");
          setAccentColor(parsed.accentColor || "#3B82F6");
        } catch (e) {
          console.error("Failed to parse converted carousel JSON:", e);
        }

        // Fetch updated revisions list
        const revRes = await fetch(`/api/posts/${id}`);
        if (revRes.ok) {
          const revData = await revRes.json();
          setRevisions(revData.revisions || []);
        }
      } else {
        alert("Conversion failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Conversion failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToNormal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${id}/convert-to-normal`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.post) {
        setPost(data.post);
        const rawContent = data.post.post_content || "";
        setPostContent(rawContent);
        setIsCarousel(false);
        setCarouselData(null);
        
        // Fetch updated revisions list
        const revRes = await fetch(`/api/posts/${id}`);
        if (revRes.ok) {
          const revData = await revRes.json();
          setRevisions(revData.revisions || []);
        }
      } else {
        alert("Conversion failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Conversion failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      if (carouselData) {
        const updated = { ...carouselData, backgroundImage: base64Data };
        setCarouselData(updated);
        const serialized = JSON.stringify(updated);
        setPostContent(serialized);
        await saveChanges(serialized, hashtags);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearBgImage = async () => {
    if (carouselData) {
      const updated = { ...carouselData };
      delete updated.backgroundImage;
      setCarouselData(updated);
      const serialized = JSON.stringify(updated);
      setPostContent(serialized);
      await saveChanges(serialized, hashtags);
    }
  };

  // Carousel slide editing
  const startEditSlide = (idx: number) => {
    if (!carouselData) return;
    const s = carouselData.slides[idx];
    setEditTitle(s.title);
    setEditBody(s.body);
    setEditSlideImage(s.image || "");
    setEditingSlide(idx);
  };

  const saveSlideEdit = async () => {
    if (editingSlide === null || !carouselData) return;
    const updatedCarousel = { ...carouselData };
    updatedCarousel.slides[editingSlide].title = editTitle;
    updatedCarousel.slides[editingSlide].body = editBody;
    updatedCarousel.slides[editingSlide].image = editSlideImage || undefined;
    
    setCarouselData(updatedCarousel);
    setEditingSlide(null);

    const serialized = JSON.stringify(updatedCarousel);
    setPostContent(serialized);
    await saveChanges(serialized, hashtags);
  };

  const handleSelectAccount = async (accountId: string) => {
    setSwitchingAccountId(accountId);
    try {
      const selectRes = await fetch("/api/linkedin/accounts/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (selectRes.ok) {
        const selectData = await selectRes.json();
        if (selectData.success) {
          // Re-fetch scraping status and accounts list
          const [accRes, listRes] = await Promise.all([
            fetch("/api/linkedin/scraping-status"),
            fetch("/api/linkedin/accounts")
          ]);
          if (accRes.ok) {
            const accData = await accRes.json();
            if (accData.status && accData.status !== "disconnected") {
              setLinkedAccount(accData);
            }
          }
          if (listRes.ok) {
            const listData = await listRes.json();
            if (listData.success) {
              setAccountsList(listData.accounts || []);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to switch account:", err);
    } finally {
      setSwitchingAccountId(null);
    }
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

      const slideBgImage = slide.image || carouselData.backgroundImage;
      let slideBgImgElement: HTMLImageElement | undefined = undefined;

      if (slideBgImage) {
        try {
          slideBgImgElement = await new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null as any);
            img.src = slideBgImage;
          });
        } catch (e) {
          console.warn("Failed to load background image, drawing without it:", e);
        }
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
          alert(`Successfully published to LinkedIn!`);
          router.push("/dashboard");
        } else if (pubData.pending_review) {
          if (isCarousel) {
            try {
              const doc = await generatePdfDocument();
              doc.save(`${(carouselData.title || "carousel").toLowerCase().replace(/[^a-z0-9]+/g, "_")}_carousel.pdf`);
            } catch (err: any) {
              console.warn("Auto-downloading carousel PDF failed:", err);
            }
          }
          alert(`Successfully copied draft to clipboard! ${pubData.message}`);
          navigator.clipboard.writeText(pubData.post_content + "\n\n" + pubData.hashtags.map((h: string) => `#${h}`).join(" "));
          window.open(pubData.redirect_url || "https://www.linkedin.com/", "_blank");
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

  const getWhatsAppShareLink = () => {
    let rawText = "";
    if (isCarousel && carouselData) {
      rawText = (carouselData.title || "") + "\n\n" + 
        carouselData.slides.map((s: any, idx: number) => `Slide ${idx + 1}: ${s.title || ""}\n${s.body || ""}`).join("\n\n");
    } else {
      rawText = postContent;
    }

    const maxTextLength = 600;
    if (rawText.length > maxTextLength) {
      rawText = rawText.substring(0, maxTextLength) + "... (truncated)";
    }

    const tagLines = hashtags.length > 0
      ? "\n\n" + hashtags.map((h: string) => h.startsWith("#") ? h : `#${h}`).join(" ")
      : "";
    const imgLine = activeImage?.url ? `\n\nImage: ${activeImage.url}` : "";
    const linkLine = post?.linkedin_post_url ? `\n\nLink: ${post.linkedin_post_url}` : "";

    const fullMessage = `${rawText}${tagLines}${imgLine}${linkLine}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMessage)}`;
  };

  // Handle Request Changes / Regenerate
  const handleRegenerate = async () => {
    if (!feedback.trim() && !attachedDocText.trim()) {
      alert("Please enter what needs to change or attach a document.");
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/content/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: id,
          feedback: feedback || "Regenerate based on attached document.",
          document_text: attachedDocText || undefined,
          style_type: regenStyleType,
          style_id: regenStyleId
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPostContent(data.approval_package.post_content);
        setHashtags(data.approval_package.hashtags);
        setFeedback("");
        setAttachedDocText("");
        setAttachedDocName("");
        setShowFeedbackInput(false);
        // Refresh revisions
        const revRes = await fetch(`/api/posts/${id}`);
        const revData = await revRes.json();
        if (revData.success) {
          setRevisions(revData.revisions);
          setPost(revData.post);

          // Update Carousel specific states if it is a carousel
          const cleanContent = (revData.post.post_content || "").trim();
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
              console.error("Failed to parse regenerated carousel JSON:", e);
            }
          } else {
            setIsCarousel(false);
            setCarouselData(null);
          }
        }
      } else {
        alert("Regeneration failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      console.error(e);
      alert("Error regenerating post: " + e.message);
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

  const activeImage = images.find((img) => img.is_selected && (img.section_index === null || img.section_index === undefined));
  const lastRevision = revisions[0] || {};

  return (
    <IosShell>
      <div className="pt-6 px-4 pb-28 md:pb-8">
        {/* iOS Nav Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="ios-back-btn">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <span className="font-semibold text-zinc-900 dark:text-white text-base">Approval Package {post?.current_revision ? `(v${post.current_revision})` : ""}</span>
          <div className="w-12" />
        </div>

        {/* LinkedIn Series Navigation Panel */}
        {seriesPosts && seriesPosts.length > 1 && (
          <div className="ios-card p-4 mb-4 select-none">
            <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5" /> LinkedIn Post Series
            </h4>
            <div className="flex items-center justify-between relative gap-2 pt-2 pb-1 overflow-x-auto scrollbar-none">
              {/* Timeline Connector Line */}
              <div className="absolute top-[21px] left-8 right-8 h-0.5 bg-zinc-200 dark:bg-zinc-800 z-0" />
              
              {seriesPosts.map((p: any, idx: number) => {
                const isActive = p.id === id;
                const statusColors: Record<string, string> = {
                  draft: "bg-zinc-500",
                  pending_approval: "bg-orange-500",
                  approved: "bg-blue-500",
                  scheduled: "bg-cyan-500",
                  published: "bg-emerald-500",
                };
                const statusDotColor = statusColors[p.status] || "bg-zinc-400";
                
                // Helper status label
                const statusLabel = p.status === "pending_approval" || p.status === "draft" 
                  ? "Draft" 
                  : p.status === "scheduled" && p.scheduled_at 
                  ? `Sched (${new Date(p.scheduled_at).toLocaleDateString()})` 
                  : p.status.toUpperCase();

                return (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/posts/${p.id}/approval`)}
                    className={`flex flex-col items-center shrink-0 min-w-16 z-10 focus:outline-none border-none bg-transparent cursor-pointer group`}
                  >
                    {/* Ring wrapper for active/hover states */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isActive 
                        ? "bg-cyan-500/20 border-2 border-cyan-400 scale-110 shadow-lg shadow-cyan-500/10" 
                        : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 group-hover:border-zinc-400 dark:group-hover:border-zinc-650"
                    }`}>
                      <span className={`text-[11px] font-extrabold ${isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-300"}`}>
                        {idx + 1}
                      </span>
                    </div>
                    {/* Status Dot */}
                    <div className="flex items-center gap-1 mt-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                      <span className={`text-[9px] font-bold tracking-tight ${isActive ? "text-cyan-400" : "text-zinc-400 group-hover:text-zinc-300"}`}>
                        Part {idx + 1}
                      </span>
                    </div>
                    <span className="text-[8px] text-zinc-500 font-medium max-w-[80px] truncate mt-0.5">
                      {statusLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Model Badge Info */}
        <div className="ios-card bg-zinc-100 dark:bg-zinc-800/40 p-3 flex justify-between items-center text-xs text-zinc-500 font-medium mb-4">
          <div className="flex items-center gap-2">
            {lastRevision.provider_used && (
              <span className="text-zinc-400 dark:text-zinc-500">Powered by {lastRevision.provider_used} ({lastRevision.model_used})</span>
            )}
          </div>
          {lastRevision.latency_ms && (
            <span>Latency: {((lastRevision.latency_ms || 1000) / 1000).toFixed(1)}s</span>
          )}
        </div>

        {/* Agent Chain of Thought */}
        {(() => {
          let originalThoughts = "";
          if (post?.agent_thoughts) {
            try {
              const parsed = JSON.parse(post.agent_thoughts);
              originalThoughts = parsed.original_thoughts || parsed.text || "";
            } catch (e) {
              originalThoughts = post.agent_thoughts;
            }
          }
          
          if (!originalThoughts || originalThoughts.trim() === "") return null;

          return (
            <div className="ios-card bg-purple-500/5 border border-purple-500/20 p-4 mb-4 select-text">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 select-none">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-purple-400" /> Content Strategy & Reasoning
              </h4>
              <div className="text-xs text-zinc-300 dark:text-zinc-300 leading-relaxed space-y-2 select-text font-normal">
                {originalThoughts.split("\n").map((line, idx) => {
                  const trimmed = line.trim();
                  if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
                    return (
                      <div key={idx} className="flex gap-2 pl-2">
                        <span className="text-purple-400">•</span>
                        <span>{trimmed.substring(1).trim()}</span>
                      </div>
                    );
                  }
                  return <p key={idx}>{line}</p>;
                })}
              </div>
            </div>
          );
        })()}

        {/* Connected Account & Profile Switcher */}
        {linkedAccount && (
          <div className="ios-card p-4 mb-4 select-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {linkedAccount.profile_picture_url ? (
                  <img
                    src={linkedAccount.profile_picture_url}
                    alt={linkedAccount.profile_name || "Author"}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-zinc-200 dark:border-zinc-800"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                    style={{ background: accentColor }}
                  >
                    {(linkedAccount.profile_name || "A").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-white leading-tight flex items-center gap-1.5">
                    {linkedAccount.profile_name || "Linked Account"}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                      Active Target
                    </span>
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1 max-w-[280px] truncate">
                    {linkedAccount.profile_headline || "LinkedIn Account"}
                  </p>
                </div>
              </div>

              {accountsList.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest shrink-0">Publish Target:</label>
                  <select
                    value={accountsList.find((a) => a.is_primary)?.id || ""}
                    onChange={(e) => handleSelectAccount(e.target.value)}
                    disabled={switchingAccountId !== null}
                    className="bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    {accountsList.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.profile_name} ({acc.account_type === "personal" ? "Personal" : "Company"})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {isCarousel && carouselData ? (
          /* CAROUSEL PREVIEW VIEW */
          <div className="space-y-6">
            <div className="ios-section-label flex justify-between items-center px-1 select-none">
              <span>Carousel Preview & Style</span>
              {post?.status !== "published" && (
                <button
                  onClick={handleConvertToNormal}
                  className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
                >
                  📝 Convert to Text Post
                </button>
              )}
            </div>

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
                  backgroundImage={carouselData.slides[previewSlide].image || carouselData.backgroundImage}
                />
              </div>

              {/* Edit overlay button */}
              {post?.status !== "published" && (
                <button
                  onClick={() => startEditSlide(previewSlide)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 border-none cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}

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

            {post?.status !== "published" && (
              <>
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

                {/* Slide Background Image Uploader */}
                <div className="ios-card p-4 space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5" /> Slide Background Image (Optional)
                  </label>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        id="carousel-bg-upload-approval"
                        className="hidden"
                        onChange={handleBgImageUpload}
                      />
                      <label
                        htmlFor="carousel-bg-upload-approval"
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-350 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                      >
                        {carouselData?.backgroundImage ? "Change Background" : "Upload Image"}
                      </label>
                      {carouselData?.backgroundImage && (
                        <button
                          onClick={handleClearBgImage}
                          className="text-xs text-red-500 font-bold hover:underline bg-transparent border-none cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {carouselData?.backgroundImage && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                        <img src={carouselData.backgroundImage} alt="Background Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Author Branding Toggle */}
                <div className="ios-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-zinc-900 dark:text-white">Author Branding</p>
                      <p className="text-xs text-zinc-500">Show photo and name on slides</p>
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
                  {showAuthor && linkedAccount?.linkedin_profile_url && (
                    <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed">
                      💡 Your LinkedIn URL will appear on the last (CTA) slide so readers can follow you.
                    </p>
                  )}
                </div>
              </>
            )}

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
                <div className="mb-3">
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
                      id={`slide-bg-upload-approval-${editingSlide}`}
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
                      htmlFor={`slide-bg-upload-approval-${editingSlide}`}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-350 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
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
              {!isEditingText && post?.status !== "published" && (
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleConvertToCarousel}
                    className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
                  >
                    ✨ Convert to Carousel
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <button
                    onClick={() => setIsEditingText(true)}
                    className="text-xs text-blue-500 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Post
                  </button>
                </div>
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
                    className="w-full text-sm text-zinc-850 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-blue-500 resize-y leading-relaxed font-sans min-h-[280px]"
                    placeholder={post?.content_type === "article" ? "Write your article here..." : "Write your post here..."}
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
                post?.content_type === "article" ? (
                  <div className="w-full space-y-6 mb-3 font-sans">
                    {/* Render Hero Image (section_index = 0) at the very top of the article */}
                    {(() => {
                      const heroImg = images.find(img => img.section_index === 0 && img.is_selected);
                      return (
                        <div className="border-b dark:border-zinc-800 pb-4 mb-4">
                          <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-2">Article Cover / Hero Image</p>
                          {heroImg ? (
                            <div className="relative rounded-2xl overflow-hidden aspect-[21/9] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
                              {heroImg.url.startsWith("data:video/") || heroImg.url.match(/\.(mp4|webm|ogg|mov|avi)($|\?)/i) ? (
                                <video src={heroImg.url} controls className="w-full h-full object-cover" />
                              ) : (
                                <img src={heroImg.url} alt="Article cover" className="w-full h-full object-cover" />
                              )}
                              {post?.status !== "published" && (
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/posts/${id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ image_url: heroImg.url, is_selected: false, section_index: 0 })
                                    });
                                    const postRes = await fetch(`/api/posts/${id}`);
                                    const postData = await postRes.json();
                                    setImages(postData.images || []);
                                  }}
                                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white border-none cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            post?.status !== "published" && (
                              <button
                                onClick={() => {
                                  setActiveImageSelectSection(0);
                                  setSectionUnsplashQuery(post?.post_title || "abstract professional background");
                                }}
                                className="w-full aspect-[21/9] rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-cyan-500/50 flex flex-col items-center justify-center text-zinc-450 cursor-pointer bg-zinc-950/20 text-xs font-bold transition-colors"
                              >
                                <ImageIcon className="w-6 h-6 mb-1 text-cyan-400" />
                                Add Article Hero Image
                              </button>
                            )
                          )}
                          
                          {activeImageSelectSection === 0 && (
                            <div className="mt-3 p-3 bg-zinc-950/40 border border-zinc-800 rounded-xl">
                              {renderSectionImageSelector(0)}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Render H1 and Sections */}
                    {parseArticleSections(postContent).map((sec) => {
                      const sectionImg = images.find(img => img.section_index === sec.index && img.is_selected);
                      const isEditingThisSection = editingSectionIndex === sec.index;
                      
                      return (
                        <div key={sec.index} className="space-y-3 relative group">
                          {/* Heading */}
                          <div className="flex items-center justify-between">
                            {sec.level === 1 ? (
                              <h1 className="text-xl font-black text-zinc-900 dark:text-white mt-4">{sec.heading}</h1>
                            ) : sec.level === 2 ? (
                              <h2 className="text-lg font-extrabold text-zinc-800 dark:text-zinc-150 mt-4">{sec.heading}</h2>
                            ) : (
                              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mt-3">{sec.heading}</h3>
                            )}
                            
                            {post?.status !== "published" && !isEditingThisSection && (
                              <button
                                onClick={() => {
                                  setEditingSectionIndex(sec.index);
                                  setEditingSectionText(sec.content);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-cyan-455 hover:underline bg-transparent border-none cursor-pointer"
                              >
                                Edit Section Text
                              </button>
                            )}
                          </div>

                          {/* Content / Text Editor */}
                          {isEditingThisSection ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingSectionText}
                                onChange={(e) => setEditingSectionText(e.target.value)}
                                className="w-full text-sm text-zinc-850 dark:text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-cyan-500 resize-y leading-relaxed font-sans min-h-[120px]"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingSectionIndex(null)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-400 border-none cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    const updatedSections = parseArticleSections(postContent).map(s => {
                                      if (s.index === sec.index) {
                                        return { ...s, content: editingSectionText };
                                      }
                                      return s;
                                    });
                                    const reconstructed = updatedSections.map(s => {
                                      const prefix = s.level === 1 ? "# " : s.level === 2 ? "## " : s.level === 3 ? "### " : "";
                                      return `${prefix}${s.heading}\n${s.content}`;
                                    }).join("\n\n");
                                    setPostContent(reconstructed);
                                    await saveChanges(reconstructed, hashtags);
                                    setEditingSectionIndex(null);
                                  }}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-black bg-cyan-600 hover:bg-cyan-700 text-white border-none cursor-pointer"
                                >
                                  Save Section
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="text-sm text-zinc-800 dark:text-zinc-250 leading-relaxed whitespace-pre-wrap select-text font-sans"
                              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(sec.content) }}
                            />
                          )}

                          {/* Section Image */}
                          {sectionImg ? (
                            <div className="relative rounded-xl overflow-hidden aspect-video bg-zinc-100 dark:bg-zinc-800 max-w-md border border-zinc-200 dark:border-zinc-800">
                              {sectionImg.url.startsWith("data:video/") || sectionImg.url.match(/\.(mp4|webm|ogg|mov|avi)($|\?)/i) ? (
                                <video src={sectionImg.url} controls className="w-full h-full object-cover" />
                              ) : (
                                <img src={sectionImg.url} alt="Section media" className="w-full h-full object-cover" />
                              )}
                              {post?.status !== "published" && (
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/posts/${id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ image_url: sectionImg.url, is_selected: false, section_index: sec.index })
                                    });
                                    const postRes = await fetch(`/api/posts/${id}`);
                                    const postData = await postRes.json();
                                    setImages(postData.images || []);
                                  }}
                                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white border-none cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            post?.status !== "published" && activeImageSelectSection !== sec.index && (
                              <button
                                onClick={() => {
                                  setActiveImageSelectSection(sec.index);
                                  setSectionUnsplashQuery(sec.heading);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-455 hover:underline bg-transparent border-none cursor-pointer"
                              >
                                <ImageIcon className="w-3.5 h-3.5" /> Add Section Image
                              </button>
                            )
                          )}

                          {activeImageSelectSection === sec.index && (
                            <div className="mt-3 p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl max-w-lg">
                              {renderSectionImageSelector(sec.index)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="w-full text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap mb-3 select-text font-sans">
                    {postContent || "(Empty Post)"}
                  </div>
                )
              )}

              <div className="text-blue-600 dark:text-blue-400 text-sm font-semibold mb-3 flex flex-wrap gap-1">
                {hashtags.map((tag) => `#${tag} `)}
              </div>

              {activeImage ? (
                <div className="space-y-2 mb-3">
                  <div className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-video bg-zinc-100 flex items-center justify-center group">
                    {activeImage.url.startsWith("data:video/") || activeImage.url.match(/\.(mp4|webm|ogg|mov|avi)($|\?)/i) ? (
                      <video src={activeImage.url} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={activeImage.url} alt="Post asset" className="w-full h-full object-cover" />
                    )}

                    {post?.status !== "published" && (
                      <button
                        onClick={async () => {
                          await fetch(`/api/posts/${id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              image_url: activeImage.url,
                              is_selected: false
                            })
                          });
                          const postRes = await fetch(`/api/posts/${id}`);
                          if (postRes.ok) {
                            const postData = await postRes.json();
                            setImages(postData.images || []);
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove media"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {post?.status !== "published" && activeImageSelectSection !== -1 && (
                    <button
                      onClick={() => {
                        setActiveImageSelectSection(-1);
                        setSectionUnsplashQuery(post?.post_title || "business concepts");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-455 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Change Image/Video
                    </button>
                  )}
                </div>
              ) : (
                post?.status !== "published" && activeImageSelectSection !== -1 && (
                  <button
                    onClick={() => {
                      setActiveImageSelectSection(-1);
                      setSectionUnsplashQuery(post?.post_title || "business concepts");
                    }}
                    className="w-full aspect-video rounded-xl border-2 border-dashed border-zinc-350 dark:border-zinc-800 hover:border-cyan-500/50 flex flex-col items-center justify-center text-zinc-450 cursor-pointer bg-zinc-950/20 text-xs font-bold transition-colors mb-3"
                  >
                    <ImageIcon className="w-6 h-6 mb-1 text-cyan-400" />
                    Add Image or Video
                  </button>
                )
              )}

              {activeImageSelectSection === -1 && (
                <div className="mt-2 mb-3 p-3 bg-zinc-950/40 border border-zinc-800 rounded-xl max-w-lg">
                  {renderSectionImageSelector(-1)}
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

        {post?.content_type === "article" && (
          <>
            <div className="ios-section-label flex justify-between items-center select-none mt-6">
              <span>Connected Feed Post Teaser</span>
            </div>
            
            {promoPosts.length === 0 ? (
              generatingPromo ? (
                <div className="ios-card p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                  <p className="text-sm font-black text-zinc-800 dark:text-zinc-250">AI is drafting your viral promo post...</p>
                  <p className="text-xs text-zinc-500 text-center max-w-xs leading-relaxed">We are formulating a high-engagement FOMO-style post referencing this article's key themes.</p>
                </div>
              ) : (
                <div className="ios-card p-4 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-850">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-250">Promote this Article</p>
                <p className="text-xs text-zinc-400 mt-1">Generate a short-form, high-engagement feed post to drive traffic to your LinkedIn article.</p>
                
                <div className="mt-4">
                  <p className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wide">Select Teaser Style</p>
                  <div className="flex gap-2 mb-4 select-none">
                    <Badge
                      onClick={() => setPromoStyleType("expert")}
                      className={`cursor-pointer rounded-full font-bold px-3 py-1 ${promoStyleType === "expert" ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400"}`}
                    >
                      Expert Voices
                    </Badge>
                    <Badge
                      onClick={() => {
                        setPromoStyleType("own")}
                      }
                      className={`cursor-pointer rounded-full font-bold px-3 py-1 ${promoStyleType === "own" ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-655 dark:text-zinc-400"}`}
                    >
                      My Voice DNA
                    </Badge>
                  </div>

                  {promoStyleType === "expert" && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
                      {[
                        { id: "fomo_style", name: "FOMO Style" },
                        { id: "justin_welsh", name: "Justin Welsh" },
                        { id: "lara_acosta", name: "Lara Acosta" },
                        { id: "sahil_bloom", name: "Sahil Bloom" }
                      ].map((style) => (
                        <div
                          key={style.id}
                          onClick={() => setSelectedPromoStyleId(style.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-center cursor-pointer transition-all text-[11px] font-bold ${
                            selectedPromoStyleId === style.id ? "border-cyan-500 bg-cyan-950/20 text-cyan-400" : "border-zinc-200 dark:border-zinc-800 text-zinc-500"
                          }`}
                        >
                          {style.name}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={generatePromoPost}
                    disabled={generatingPromo}
                    className="w-full py-3.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 disabled:from-zinc-850 disabled:to-zinc-850 disabled:text-zinc-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md border-none cursor-pointer transition-all duration-200 text-xs"
                  >
                    {generatingPromo ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Generating Teaser...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Generate Teaser Feed Post
                      </>
                    )}
                  </button>
                </div>
              </div>
            )) : (
              promoPosts.map((promo) => (
                <div key={promo.id} className="ios-card p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wide">Teaser Draft ({promo.status})</span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Will link to this article: {post.status === "published" ? "Live Link" : "Placeholder Link"}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/posts/${promo.id}/approval`)}
                      className="text-xs font-bold text-cyan-500 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Open Editor →
                    </button>
                  </div>

                  <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800/80 rounded-xl text-xs text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed select-text font-sans">
                    {promo.post_content}
                  </div>

                  <div className="flex flex-wrap gap-1 text-[10px] text-cyan-500 font-semibold">
                    {promo.hashtags?.map((tag: string) => `#${tag} `)}
                  </div>

                  {post.status === "published" && (!post.linkedin_post_url || post.linkedin_post_url.includes("post/new")) && (
                    <div className="p-3 bg-cyan-950/20 border border-cyan-800/30 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-cyan-400">🔗 Paste published LinkedIn Article URL</p>
                      <p className="text-[10px] text-zinc-400">Paste your article's link from LinkedIn below so the promotional feed post can link directly to it.</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id={`live-article-url-input-${promo.id}`}
                          placeholder="https://www.linkedin.com/pulse/..."
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={async () => {
                            const val = (document.getElementById(`live-article-url-input-${promo.id}`) as HTMLInputElement)?.value;
                            if (val && val.trim().startsWith("http")) {
                              const res = await fetch(`/api/posts/${id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "published", linkedin_post_url: val.trim() }),
                              });
                              if (res.ok) {
                                alert("Live article URL saved successfully!");
                                window.location.reload();
                              }
                            } else {
                              alert("Please enter a valid HTTP URL");
                            }
                          }}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-xs font-bold text-white rounded-lg border-none cursor-pointer"
                        >
                          Save Link
                        </button>
                      </div>
                    </div>
                  )}

                  {promo.status !== "published" && (
                    <button
                      onClick={() => handlePublishPromoPost(promo.id)}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl text-xs border-none cursor-pointer"
                    >
                      🚀 Approve & Publish Promo Post
                    </button>
                  )}
                </div>
              ))
            )}
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
                {post?.status !== "published" && (
                  <button onClick={() => handleRemoveHash(idx)} className="text-zinc-400 hover:text-zinc-650 bg-transparent border-none cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
            {post?.status !== "published" && (
              <button
                onClick={() => setShowAddHash(!showAddHash)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-500 hover:text-zinc-700 bg-transparent cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add tag
              </button>
            )}
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
        {post?.status !== "published" && (
          <>
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
          </>
        )}

        {/* Action Controls */}
        <div className="py-4 px-4 md:px-0">
          {post?.status === "published" ? (
            <div className="ios-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 !mx-0">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-base select-none">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Published to LinkedIn</span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                {post?.linkedin_post_url && (
                  <a
                    href={post.linkedin_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-5 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-98 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold cursor-pointer transition-all duration-200 no-underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Post
                  </a>
                )}
                
                <a
                  href={getWhatsAppShareLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-98 shadow-sm border-none text-xs font-semibold cursor-pointer transition-all duration-200 no-underline"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.424 5.429 0 12.085 0c3.225.001 6.258 1.258 8.54 3.541 2.283 2.283 3.538 5.32 3.538 8.545 0 6.661-5.429 12.085-12.088 12.085-2.007-.001-3.98-.502-5.732-1.464L0 24zm6.076-3.488c1.65.981 3.267 1.498 4.908 1.499 5.568 0 10.101-4.53 10.105-10.103.002-2.701-1.047-5.241-2.956-7.151C16.281 2.847 13.743 1.797 11.047 1.797c-5.572 0-10.105 4.534-10.109 10.107-.002 1.812.479 3.582 1.393 5.161l-.92 3.364 3.447-.905.175.104zM16.59 13.9c-.3-.15-1.78-.88-2.03-1.025-.25-.09-.43-.15-.61.15-.18.3-.7.88-.86 1.05-.16.18-.32.2-.62.05-.3-.15-1.27-.47-2.42-1.5-1-.89-1.675-2-1.875-2.35-.2-.3-.02-.45.13-.6.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.6-1.46-.82-2-1.99-.215-.26-.15-.43-.15-.6 0-.18-.08-.3-.08-.43 0-.15-.05-.3-.05-.45c-.07-.15-.3-.23-.6-.08-2.61 1.31-2.82 4.82-2.82 5.09 0 .27.1 2.69 2.5 5.04 1.71 1.68 3.51 2.76 5.36 3.42.92.33 1.76.27 2.42.17.74-.11 2.27-.93 2.59-1.83.32-.9.32-1.67.23-1.83-.09-.15-.3-.25-.6-.4z"/>
                  </svg>
                  Share to WhatsApp
                </a>
              </div>
            </div>
          ) : showFeedbackInput ? (
            <div className="ios-card p-4 space-y-3 bg-red-50/20 dark:bg-red-950/10 border border-red-500/20 !mx-0">
              <label className="text-xs font-bold text-red-500 dark:text-red-400 uppercase">What needs to change?</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Example: Make it shorter. Make the opener more interesting. Add bullet points..."
                className="w-full h-24 p-3 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              />

              {/* Writing Style Selection */}
              <div className="space-y-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Change Writing Style (Optional)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegenStyleType("expert");
                      if (expertStyles.length > 0 && !expertStyles.some(s => s.id === regenStyleId)) {
                        setRegenStyleId(expertStyles[0].id);
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                      regenStyleType === "expert"
                        ? "bg-zinc-850 border-zinc-700 text-cyan-400"
                        : "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Expert Voices
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegenStyleType("own");
                      if (customStyles.length > 0) {
                        setRegenStyleId(customStyles[0].id);
                      } else {
                        setRegenStyleId("fomo_style");
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                      regenStyleType === "own"
                        ? "bg-zinc-850 border-zinc-700 text-cyan-400"
                        : "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    My Voice DNA
                  </button>
                </div>

                <select
                  value={regenStyleId}
                  onChange={(e) => setRegenStyleId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {regenStyleType === "expert" ? (
                    <>
                      <option value="fomo_style">FOMO Teaser Style (Default)</option>
                      {expertStyles.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.name} ({style.style_json?.tone || "Expert Style"})
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      {customStyles.length === 0 ? (
                        <option value="fomo_style" disabled>No Voice DNA created yet</option>
                      ) : (
                        customStyles.map((style) => (
                          <option key={style.id} value={style.id}>
                            {style.name}
                          </option>
                        ))
                      )}
                    </>
                  )}
                </select>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500 py-1 flex-wrap gap-2">
                <div className="flex gap-2">
                  {isRecordingFeedback ? (
                    <button
                      type="button"
                      onClick={stopFeedbackRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-650 hover:bg-red-700 text-white font-semibold animate-pulse border-none cursor-pointer text-xs"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" /> Stop ({feedbackRecordingDuration}s)
                    </button>
                  ) : isTranscribingFeedback ? (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-250 dark:bg-zinc-800 text-zinc-400 font-semibold border-none cursor-not-allowed text-xs"
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing...
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startFeedbackRecording}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-350 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold border-none cursor-pointer text-xs"
                    >
                      <Mic className="w-3.5 h-3.5 text-red-500" /> Record voice
                    </button>
                  )}

                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-350 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold border-none cursor-pointer text-xs">
                    <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                    {uploadingDoc ? "Parsing..." : "Upload Document"}
                    <input
                      type="file"
                      accept=".txt,.md,.pdf"
                      className="hidden"
                      onChange={handleDocUpload}
                      disabled={uploadingDoc}
                    />
                  </label>
                </div>
              </div>

              {attachedDocName && (
                <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl p-2.5 text-xs">
                  <span className="truncate max-w-[80%] font-medium">📎 Attached: {attachedDocName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedDocName("");
                      setAttachedDocText("");
                    }}
                    className="text-blue-500 hover:text-blue-700 bg-transparent border-none cursor-pointer font-bold text-xs"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-bold border-none cursor-pointer text-xs"
                >
                  {regenerating ? "Regenerating..." : "Regenerate content"}
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
                    {scheduleMode === "schedule"
                      ? "Approve & Schedule"
                      : "Approve & Publish"}
                  </>
                )}
              </button>

              <a
                href={getWhatsAppShareLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-[calc(100%-32px)] md:w-auto md:px-8 mx-4 md:mx-0 my-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md border-none text-[17px] font-semibold cursor-pointer transition-all duration-200 no-underline"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.424 5.429 0 12.085 0c3.225.001 6.258 1.258 8.54 3.541 2.283 2.283 3.538 5.32 3.538 8.545 0 6.661-5.429 12.085-12.088 12.085-2.007-.001-3.98-.502-5.732-1.464L0 24zm6.076-3.488c1.65.981 3.267 1.498 4.908 1.499 5.568 0 10.101-4.53 10.105-10.103.002-2.701-1.047-5.241-2.956-7.151C16.281 2.847 13.743 1.797 11.047 1.797c-5.572 0-10.105 4.534-10.109 10.107-.002 1.812.479 3.582 1.393 5.161l-.92 3.364 3.447-.905.175.104zM16.59 13.9c-.3-.15-1.78-.88-2.03-1.025-.25-.09-.43-.15-.61.15-.18.3-.7.88-.86 1.05-.16.18-.32.2-.62.05-.3-.15-1.27-.47-2.42-1.5-1-.89-1.675-2-1.875-2.35-.2-.3-.02-.45.13-.6.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.6-1.46-.82-2-1.99-.215-.26-.15-.43-.15-.6 0-.18-.08-.3-.08-.43 0-.15-.05-.3-.05-.45c-.07-.15-.3-.23-.6-.08-2.61 1.31-2.82 4.82-2.82 5.09 0 .27.1 2.69 2.5 5.04 1.71 1.68 3.51 2.76 5.36 3.42.92.33 1.76.27 2.42.17.74-.11 2.27-.93 2.59-1.83.32-.9.32-1.67.23-1.83-.09-.15-.3-.25-.6-.4z"/>
                </svg>
                Forward to WhatsApp
              </a>

              <button
                onClick={() => setShowFeedbackInput(true)}
                className="w-[calc(100%-32px)] md:w-auto md:px-8 mx-4 md:mx-0 my-2 bg-transparent hover:bg-red-500/10 text-red-500 hover:text-red-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 border border-red-500/30 text-[17px] font-semibold cursor-pointer transition-all duration-200"
              >
                Request changes
              </button>
            </div>
          )}
        </div>

        {/* Engagement Comments Console */}
        <div className="flex items-center justify-between pr-4">
          <div className="ios-section-label">LinkedIn Comments & Engagement</div>
          {post?.status === "published" && (
            <button
              onClick={() => fetchComments({ refresh: true })}
              disabled={loadingComments || refreshingComments}
              className="text-xs font-semibold text-cyan-500 hover:text-cyan-400 disabled:text-zinc-500 bg-transparent border-none cursor-pointer flex items-center gap-1 mt-6"
            >
              {refreshingComments ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw mr-0.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                  Refresh Now
                </>
              )}
            </button>
          )}
        </div>
        <div className="ios-card p-4 space-y-4 mb-6">
          {post?.status === "published" && likesCount !== null && (
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Likes</span>
                <span className="text-lg font-black text-blue-500 mt-1">{likesCount}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Comments</span>
                <span className="text-lg font-black text-cyan-500 mt-1">{commentsCount ?? comments.length}</span>
              </div>
            </div>
          )}

          {post?.status !== "published" ? (
            <p className="text-xs text-zinc-500 text-center py-4">Comments will become available once this post is published.</p>
          ) : loadingComments ? (
            <div className="py-6 flex flex-col items-center">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500 mb-2" />
              <span className="text-xs text-zinc-500 font-medium">Checking LinkedIn comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No comments found on this post yet.</p>
          ) : (
            <div className="space-y-6">
              {comments.map((comment) => {
                const cid = comment.id;
                const drafts = commentDrafts[cid] || [];
                const isDrafting = loadingDrafts[cid];
                const isRecording = voiceRecordingCommentId === cid;
                const isTranscribing = voiceTranscribingCommentId === cid;
                const isPosting = postingReply[cid];

                return (
                  <div key={cid} className="border-b border-zinc-200 dark:border-zinc-800 pb-6 last:border-0 last:pb-0">
                    {/* Commenter info */}
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs shrink-0 select-none">
                        {comment.commenter_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-800 dark:text-white truncate">
                            {comment.commenter_name}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">{comment.commenter_headline}</p>
                      </div>
                    </div>

                    {/* Comment Text */}
                    <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed mb-3">
                      {comment.comment_text}
                    </div>

                    {/* Thread History (Nested replies) */}
                    {comment.thread_history && comment.thread_history.length > 0 && (
                      <div className="ml-6 space-y-3 mb-3 border-l-2 border-zinc-200 dark:border-zinc-800 pl-3">
                        {comment.thread_history.map((reply: any, rIdx: number) => (
                          <div key={rIdx} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                                {reply.commenter_name}
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {reply.commenter_headline && (
                              <p className="text-[9px] text-zinc-450 leading-none">{reply.commenter_headline}</p>
                            )}
                            <p className="text-xs text-zinc-800 dark:text-zinc-300 bg-zinc-100/50 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 leading-relaxed">
                              {reply.comment_text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fallback to local reply_text if thread_history is empty */}
                    {(!comment.thread_history || comment.thread_history.length === 0) && comment.reply_text && (
                      <div className="ml-6 border-l-2 border-green-500 pl-3 py-0.5 space-y-1 mb-3">
                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider block">Your Reply:</span>
                        <p className="text-xs text-zinc-800 dark:text-zinc-300 leading-relaxed bg-green-50/10 p-2.5 rounded-xl border border-green-500/10">
                          {comment.reply_text}
                        </p>
                      </div>
                    )}

                    {/* Drafting and Action Panel if not replied yet */}
                    {(() => {
                      const activeProfileUrn = linkedAccount?.linkedin_profile_id || "";
                      const hasReplied = !!comment.reply_text || 
                        (comment.thread_history && comment.thread_history.some((reply: any) => 
                          reply.actor === activeProfileUrn || 
                          (activeProfileUrn && reply.actor?.endsWith(activeProfileUrn.split(":").pop() || "___"))
                        ));

                      if (hasReplied) return null;

                      return (
                        <div className="space-y-3">
                        {/* 3 Auto Draft options */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Suggested Replies</span>
                            <button
                              onClick={() => handleGenerateDrafts(comment)}
                              disabled={isDrafting}
                              className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 bg-transparent border-none cursor-pointer flex items-center gap-1"
                            >
                              {isDrafting ? "Drafting..." : (drafts.length > 0 ? "Regenerate" : "Draft Replies")}
                            </button>
                          </div>

                          {drafts.length > 0 && (
                            <div className="grid grid-cols-1 gap-2">
                              {drafts.map((draft, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setCommentReplies(prev => ({ ...prev, [cid]: draft }))}
                                  className="text-left p-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 transition-colors rounded-xl text-[11px] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 leading-relaxed cursor-pointer"
                                >
                                  <span className="font-semibold text-cyan-450 block mb-0.5">
                                    {idx === 0 ? "Short & Punchy:" : idx === 1 ? "Value-Add:" : "Question-based:"}
                                  </span>
                                  {draft}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Editor Input Area */}
                        <div className="relative">
                          <textarea
                            value={commentReplies[cid] || ""}
                            onChange={(e) => setCommentReplies(prev => ({ ...prev, [cid]: e.target.value }))}
                            placeholder="Draft your reply or record voice input..."
                            className="w-full min-h-[70px] p-3 pr-10 bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl text-xs focus:border-cyan-500 outline-none leading-relaxed resize-none"
                          />
                          
                          {/* Voice input button inside editor */}
                          <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                            {isTranscribing ? (
                              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                            ) : isRecording ? (
                              <button
                                onClick={stopVoiceRecording}
                                className="w-7 h-7 rounded-full bg-red-650 flex items-center justify-center text-white border-none cursor-pointer animate-pulse"
                              >
                                <span className="w-2.5 h-2.5 bg-white rounded-sm" />
                              </button>
                            ) : (
                              <button
                                onClick={() => startVoiceRecording(cid)}
                                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-350 border-none cursor-pointer"
                                title="Reply with voice"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2">
                          {commentReplies[cid] && (
                            <button
                              onClick={() => setCommentReplies(prev => {
                                const copy = { ...prev };
                                delete copy[cid];
                                return copy;
                              })}
                              className="px-3 h-8 text-[11px] font-semibold text-zinc-400 bg-transparent border border-zinc-800 rounded-xl cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                          <button
                            onClick={() => handlePostReply(cid)}
                            disabled={isPosting || !commentReplies[cid]}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-zinc-850 disabled:text-zinc-500 px-4 h-8 text-[11px] font-semibold rounded-xl text-white border-none cursor-pointer flex items-center gap-1.5 transition-colors"
                          >
                            {isPosting ? "Posting..." : "Post Reply"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                );
              })}
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
