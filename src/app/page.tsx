"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SparklesCore } from "@/components/ui/sparkles-core";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { HeroSection } from "@/components/ui/hero-section";
import { PricingCard } from "@/components/ui/dark-gradient-pricing";

export default function LandingPage() {
  const router = useRouter();
  const pricingRef = useRef<HTMLDivElement>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setIsAuthenticated(true);
          }
        }
      } catch (e) {}
    }
    checkSession();
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
    router.refresh();
  };

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCtaClick = () => {
    if (isAuthenticated) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto select-text scroll-smooth">
      {/* Navigation Header */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/")}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
            <span className="font-extrabold text-white text-lg font-mono">VP</span>
          </div>
          <div>
            <h2 className="font-extrabold text-sm tracking-tight text-white leading-tight">VoicePost</h2>
            <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Social AI Studio</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 select-none">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 cursor-pointer transition-all duration-200"
              >
                Dashboard
              </button>
              <button
                onClick={handleSignOut}
                className="text-xs sm:text-sm font-semibold text-red-500 hover:text-red-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 cursor-pointer transition-all duration-200"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 cursor-pointer transition-all duration-200"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Hero Section Container */}
      <div className="relative min-h-[90vh] w-full flex flex-col items-center justify-center overflow-hidden">
        {/* Background SVG paths */}
        <div className="absolute inset-0 z-0 opacity-40">
          <BackgroundPaths title="" showContent={false} />
        </div>

        {/* Sparkles particle animation */}
        <div className="absolute inset-0 z-10">
          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1.2}
            particleDensity={70}
            particleColor="#007aff"
            speed={1.2}
            className="w-full h-full"
          />
        </div>

        {/* Hero Section overlay content */}
        <div className="relative z-20 w-full pt-16">
          <HeroSection
            title="Turn your voice into"
            animatedTexts={[
              "viral LinkedIn posts",
              "authentic content",
              "your personal brand",
              "thought leadership"
            ]}
            subtitle="Speak for 60 seconds. Get a perfectly written, human-sounding LinkedIn post in your exact voice. Connect LinkedIn, approve, publish."
            infoBadgeText="Free plan — 3 posts/week, no card needed"
            ctaButtonText={isAuthenticated ? "Go to Dashboard" : "Start for free"}
            socialProofText="Join 2,400+ professionals already posting"
            onCtaClick={handleCtaClick}
            avatars={[
              { src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40", alt: "User", fallback: "JW" },
              { src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=40", alt: "User", fallback: "LA" },
              { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40", alt: "User", fallback: "AH" }
            ]}
          />

          {isAuthenticated && (
            <div className="flex justify-center -mt-6 mb-12 relative z-30">
              <button
                onClick={handleSignOut}
                className="text-sm font-bold text-red-500 hover:text-red-400 px-8 py-3.5 rounded-2xl bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-950/20"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* How it Works Video Walkthrough Section */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center relative z-20 border-t border-zinc-900/60">
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-6">
          See how VoicePost works in 10 seconds
        </h2>
        <p className="text-zinc-400 text-base sm:text-lg max-w-xl mx-auto mb-10 font-medium">
          Watch our fast-paced overview showing voice/media uploader, styling engines, carousel generator, and secure approval pipeline.
        </p>
        <div className="relative rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video shadow-2xl flex items-center justify-center">
          <video
            className="w-full h-full object-cover"
            controls
            autoPlay
            muted
            loop
            playsInline
            src="https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-his-computer-38534-large.mp4"
            poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200"
          />
        </div>
      </div>

      {/* Pricing Section */}
      <div ref={pricingRef} className="py-24 px-4 bg-black border-t border-zinc-900 relative z-30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-6">
              Simple, transparent pricing
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto mb-8">
              Choose the plan that fits your posting schedule. Cancel or upgrade anytime.
            </p>

            {/* iOS Styled Billing Toggle Segment */}
            <div className="inline-flex bg-zinc-800 p-1 rounded-2xl border border-zinc-700 select-none">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  billingPeriod === "monthly"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  billingPeriod === "yearly"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Yearly <span className="text-xs text-blue-300 ml-1">Save 25%</span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            <PricingCard
              tier="Free"
              price="$0/mo"
              yearlyPrice="$0/yr"
              period={billingPeriod}
              bestFor="3 posts/week · No card needed"
              CTA="Get started free"
              onClick={handleCtaClick}
              benefits={[
                { text: "3 posts per week (resets Monday)", checked: true },
                { text: "1 LinkedIn account", checked: true },
                { text: "Personal + 3 expert writing styles", checked: true },
                { text: "Image search (Unsplash + Pexels)", checked: true },
                { text: "3 AI image generations/week", checked: true },
                { text: "Groq + NVIDIA NIM models", checked: true },
                { text: "Custom style builder", checked: false },
                { text: "Style blending", checked: false },
              ]}
            />
            <PricingCard
              tier="Starter"
              price="$5/mo"
              yearlyPrice="$4/mo (billed $50/yr)"
              period={billingPeriod}
              bestFor="15 posts/month · Starter builder"
              CTA="Start Starter plan"
              popular={true}
              onClick={handleCtaClick}
              benefits={[
                { text: "15 posts per month", checked: true },
                { text: "1 LinkedIn account", checked: true },
                { text: "All expert styles + custom builder", checked: true },
                { text: "10 AI image generations/month", checked: true },
                { text: "Groq + Google AI Studio models", checked: true },
                { text: "Style blending", checked: false },
                { text: "Scheduled posting", checked: false },
              ]}
            />
            <PricingCard
              tier="Pro"
              price="$12/mo"
              yearlyPrice="$8/mo (billed $100/yr)"
              period={billingPeriod}
              bestFor="60 posts/month · 3 Accounts"
              CTA="Go Pro"
              onClick={handleCtaClick}
              benefits={[
                { text: "60 posts per month", checked: true },
                { text: "3 LinkedIn accounts", checked: true },
                { text: "All styles + style blending", checked: true },
                { text: "60 AI image generations/month", checked: true },
                { text: "NVIDIA NIM + Cerebras (faster AI)", checked: true },
                { text: "Scheduled posting", checked: true },
                { text: "Priority generation queue", checked: true },
              ]}
            />
            <PricingCard
              tier="Agency"
              price="$29/mo"
              yearlyPrice="$21/mo (billed $250/yr)"
              period={billingPeriod}
              bestFor="Unlimited · 10 accounts · White-label"
              CTA="Contact sales"
              onClick={handleCtaClick}
              benefits={[
                { text: "Unlimited posts", checked: true },
                { text: "10 LinkedIn accounts", checked: true },
                { text: "White-label option", checked: true },
                { text: "API access + key generation", checked: true },
                { text: "All models including best available", checked: true },
                { text: "Dedicated support", checked: true },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-black text-center border-t border-zinc-900 relative z-30">
        <p className="text-zinc-500 text-sm mb-2">Cancel anytime · Secure via Stripe Checkout</p>
        <p className="text-zinc-600 text-xs">© {new Date().getFullYear()} VoicePost Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
