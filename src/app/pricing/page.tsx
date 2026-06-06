"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { PricingCard } from "@/components/ui/dark-gradient-pricing";

export default function PricingPage() {
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const handleStartPlan = (tier: string) => {
    // In a production app, we would redirect to a Stripe checkout session:
    // fetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ tier, billingPeriod }) })
    alert(`Redirecting to Stripe Checkout for ${tier} (${billingPeriod}) plan!`);
    router.push("/dashboard");
  };

  return (
    <IosShell>
      <div className="pt-6 px-4">
        <h1 className="ios-large-title">Plans</h1>

        {/* iOS Styled Billing Toggle Segment */}
        <div className="ios-segment mb-6 select-none">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`ios-segment-btn ${billingPeriod === "monthly" ? "active" : ""}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod("yearly")}
            className={`ios-segment-btn ${billingPeriod === "yearly" ? "active" : ""}`}
          >
            Yearly (Save 25%)
          </button>
        </div>

        {/* Vertical scrollable stack of Pricing Cards */}
        <div className="space-y-6 max-w-md mx-auto pb-10">
          <PricingCard
            tier="Free"
            price="$0/mo"
            yearlyPrice="$0/yr"
            period={billingPeriod}
            bestFor="3 posts/week · No card needed"
            CTA="Get started free"
            onClick={() => handleStartPlan("Free")}
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
            onClick={() => handleStartPlan("Starter")}
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
            onClick={() => handleStartPlan("Pro")}
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
            onClick={() => handleStartPlan("Agency")}
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
    </IosShell>
  );
}
