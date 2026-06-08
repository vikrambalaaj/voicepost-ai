import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const STATIC_EXPERTS = [
  {
    id: "fomo_style",
    name: "FOMO Style",
    handle: "@FOMOStyle",
    best_for: ["virality", "conversion", "high-impression"],
    description: "FOMO-driven copywriting style designed for high-impression professional posts with provocative hooks, structured bullet sections, and zero fluff.",
    style_json: {
      avg_post_length_words: 300,
      tone_descriptor: "authoritative, urgent, professional",
      uses_emojis: false,
      emoji_frequency: "none",
      uses_line_breaks_for_drama: true,
      sentence_length_pattern: "provocative hook, structured cluster",
      opener_patterns: ["Bold provocative statement", "Uncomfortable truth"],
      avoided_corporate_words: ["In today's world", "Let's dive in", "delve", "leverage"],
      cta_style: "one question to drive engagement",
      hashtag_style: "none",
      storytelling_ratio: 0.3
    },
    example_post: "Bold provocative statement or uncomfortable truth.\n\nShort setup that creates tension or curiosity.\n\n- Bullet header\n  Sharp insight 1.\n  Sharp insight 2.\n\nOne sentence that reinforces the cost of inaction.\n\nOne question to trigger comments?",
    sort_order: 0,
    enabled: true
  },
  {
    id: "justin_welsh",
    name: "Justin Welsh",
    handle: "@JustinWelsh",
    best_for: ["thought leadership", "solopreneurship", "growth"],
    description: "Structured, concise, spacing-heavy style built around actionable growth blueprints and frameworks.",
    style_json: {
      avg_post_length_words: 150,
      tone_descriptor: "authoritative, educational, structured",
      uses_emojis: false,
      emoji_frequency: "none",
      uses_line_breaks_for_drama: true,
      sentence_length_pattern: "short-short-long",
      opener_patterns: ["Most people focus on the wrong things.", "Here is the simple blueprint to..."],
      avoided_corporate_words: ["leverage", "delve", "game-changer", "transformative"],
      cta_style: "minimal, link in comment",
      hashtag_style: "none",
      storytelling_ratio: 0.3
    },
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
    style_json: {
      avg_post_length_words: 120,
      tone_descriptor: "encouraging, friendly, self-reflective",
      uses_emojis: true,
      emoji_frequency: "low",
      uses_line_breaks_for_drama: true,
      sentence_length_pattern: "conversational, varied",
      opener_patterns: ["I spent 3 years trying to figure out LinkedIn.", "Honestly, personal branding is just..."],
      avoided_corporate_words: ["synergy", "paradigm shift", "disruptive"],
      cta_style: "engaging question at the end",
      hashtag_style: "none",
      storytelling_ratio: 0.6
    },
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
    style_json: {
      avg_post_length_words: 110,
      tone_descriptor: "direct, pragmatic, high-conviction",
      uses_emojis: false,
      emoji_frequency: "none",
      uses_line_breaks_for_drama: true,
      sentence_length_pattern: "ultra-short, punchy",
      opener_patterns: ["You don't need more leads. You need...", "I noticed something about poor entrepreneurs."],
      avoided_corporate_words: ["empower", "spearhead", "seamlessly"],
      cta_style: "none, direct statement",
      hashtag_style: "none",
      storytelling_ratio: 0.5
    },
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
    style_json: {
      avg_post_length_words: 200,
      tone_descriptor: "intellectual, curious, structured",
      uses_emojis: true,
      emoji_frequency: "medium",
      uses_line_breaks_for_drama: true,
      sentence_length_pattern: "varied, essayistic",
      opener_patterns: ["The Golden Rule of...", "Most people realize this too late:"],
      avoided_corporate_words: ["cutting-edge", "synergy", "disruptive"],
      cta_style: "newsletter signup",
      hashtag_style: "minimal",
      storytelling_ratio: 0.4
    },
    example_post: "Most people realize this too late: The golden rule of productivity is focus...",
    sort_order: 4,
    enabled: true
  }
];

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    // Dynamically seed database with static experts on request
    for (const expert of STATIC_EXPERTS) {
      await db.from("expert_styles").upsert({
        id: expert.id,
        name: expert.name,
        handle: expert.handle,
        best_for: expert.best_for,
        description: expert.description,
        style_json: expert.style_json,
        example_post: expert.example_post,
        sort_order: expert.sort_order,
        enabled: expert.enabled,
      }, { onConflict: "id" });
    }

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
