"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SparklesCore } from "@/components/ui/sparkles-core";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { HeroSection } from "@/components/ui/hero-section";
import { PricingCard } from "@/components/ui/dark-gradient-pricing";

export default function LandingPage() {
  const router = useRouter();
  const pricingRef = useRef<HTMLDivElement>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCtaClick = () => {
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto select-text scroll-smooth">
      {/* Hero Section Container */}
      <div className="relative min-h-[90vh] w-full flex items-center justify-center overflow-hidden">
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
            ctaButtonText="Start for free"
            socialProofText="Join 2,400+ professionals already posting"
            onCtaClick={handleCtaClick}
            avatars={[
              { src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40", alt: "User", fallback: "JW" },
              { src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=40", alt: "User", fallback: "LA" },
              { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40", alt: "User", fallback: "AH" }
            ]}
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
