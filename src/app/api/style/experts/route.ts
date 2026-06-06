import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const STATIC_EXPERTS = [
  {
    id: "justin_welsh",
    name: "Justin Welsh",
    handle: "@JustinWelsh",
    best_for: ["thought leadership", "solopreneurship", "growth"],
    description: "Structured, concise, spacing-heavy style built around actionable growth blueprints and frameworks.",
    example_post: "Most people focus on the wrong things. They buy tools they don't need...",
    sort_order: 1,
    enabled: true
  },
  {
    id: "lara_acosta",
    name: "Lara Acosta",
    handle: "@LaraAcosta",
    best_for: ["personal branding", "social media strategy", "linkedin growth"],
    description: "High energy, conversational, self-reflective style. Focuses on personal branding, mistakes made, and practical advice.",
    example_post: "I spent 3 years trying to figure out LinkedIn. Honestly, it boils down to one simple thing...",
    sort_order: 2,
    enabled: true
  },
  {
    id: "alex_hormozi",
    name: "Alex Hormozi",
    handle: "@AlexHormozi",
    best_for: ["sales", "scaling", "acquisition"],
    description: "Punchy, ultra-short sentences, high-impact storytelling, highly pragmatic business advice.",
    example_post: "You don't need more leads. You need to charge more for what you sell...",
    sort_order: 3,
    enabled: true
  },
  {
    id: "sahil_bloom",
    name: "Sahil Bloom",
    handle: "@SahilBloom",
    best_for: ["curiosity", "productivity", "habits"],
    description: "Structured essays, frameworks, visual breakdowns, intellectual tone.",
    example_post: "Most people realize this too late: The golden rule of productivity is focus...",
    sort_order: 4,
    enabled: true
  }
];

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const { data: experts, error } = await db
      .from("expert_styles")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    if (error || !experts || experts.length === 0) {
      console.warn("Using static fallback for expert styles.");
      return NextResponse.json({ success: true, experts: STATIC_EXPERTS }, { status: 200 });
    }

    return NextResponse.json({ success: true, experts }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: true, experts: STATIC_EXPERTS }, { status: 200 });
  }
}
