"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export interface AvatarItem {
  src: string;
  alt: string;
  fallback: string;
}

export interface HeroSectionProps {
  title: string;
  animatedTexts: string[];
  subtitle: string;
  infoBadgeText?: string;
  ctaButtonText: string;
  socialProofText?: string;
  avatars?: AvatarItem[];
  onCtaClick?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  animatedTexts,
  subtitle,
  infoBadgeText,
  ctaButtonText,
  socialProofText,
  avatars,
  onCtaClick,
}) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    const fullText = animatedTexts[currentTextIndex];
    
    const handleTyping = () => {
      if (!isDeleting) {
        // Typing
        setDisplayedText(fullText.substring(0, displayedText.length + 1));
        if (displayedText === fullText) {
          // Pause before deleting
          setIsDeleting(true);
          setTypingSpeed(2500); // Wait 2.5s to read
        } else {
          setTypingSpeed(75 + Math.random() * 50);
        }
      } else {
        // Deleting
        setDisplayedText(fullText.substring(0, displayedText.length - 1));
        if (displayedText === "") {
          setIsDeleting(false);
          setCurrentTextIndex((prev) => (prev + 1) % animatedTexts.length);
          setTypingSpeed(400); // Pause before next word
        } else {
          setTypingSpeed(35);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, currentTextIndex, animatedTexts, typingSpeed]);

  return (
    <div className="flex flex-col items-center text-center max-w-3xl mx-auto px-6 py-16 relative z-20">
      {infoBadgeText && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 text-xs font-semibold text-cyan-400 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.05)]"
        >
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          {infoBadgeText}
        </motion.div>
      )}

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-8"
      >
        {title}{" "}
        <span className="block mt-3 sm:inline-block sm:mt-0 p-1 px-4 border border-cyan-500/20 rounded-2xl bg-cyan-950/30 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          {displayedText}
          <span className="inline-block w-[3px] h-[34px] sm:h-[42px] bg-cyan-400 ml-1.5 align-middle animate-pulse" />
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-base sm:text-lg text-zinc-300 max-w-xl mb-12 leading-relaxed font-medium"
      >
        {subtitle}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="w-full flex justify-center mb-12"
      >
        <Button
          onClick={onCtaClick}
          className="w-full sm:w-auto px-10 py-6.5 rounded-2xl text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.2)] hover:shadow-[0_0_40px_rgba(6,182,212,0.35)] transition-all duration-300 hover:-translate-y-0.5"
        >
          {ctaButtonText}
        </Button>
      </motion.div>

      {avatars && avatars.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900/60 p-3.5 px-6 rounded-2xl border border-zinc-800/80 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        >
          <div className="flex -space-x-3">
            {avatars.map((avatar, idx) => (
              <Avatar key={idx} className="border-2 border-zinc-950 w-10 h-10 shadow-md">
                <AvatarImage src={avatar.src} alt={avatar.alt} />
                <AvatarFallback className="text-xs bg-zinc-800 text-zinc-300">
                  {avatar.fallback}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {socialProofText && (
            <p className="text-sm font-semibold text-zinc-300 tracking-wide">
              {socialProofText}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};
