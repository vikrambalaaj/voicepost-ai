import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function cleanHtmlToText(html: string): string {
  let text = html;
  // Remove script and style tags
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  // Replace block tags with newlines
  text = text.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr)>/gi, "\n");
  text = text.replace(/<(br|hr)\s*\/?>/gi, "\n");
  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, " ")
             .replace(/&amp;/gi, "&")
             .replace(/&lt;/gi, "<")
             .replace(/&gt;/gi, ">")
             .replace(/&quot;/gi, '"')
             .replace(/&#39;/gi, "'");
  // Normalize whitespace
  return text.split("\n").map(line => line.trim()).filter(line => line.length > 0).join("\n");
}

function extractImages(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    try {
      const absoluteUrl = new URL(src, baseUrl).href;
      const lowerUrl = absoluteUrl.toLowerCase();
      
      // Skip inline SVG data urls
      if (lowerUrl.startsWith("data:image/svg") || lowerUrl.startsWith("data:application")) {
        continue;
      }
      
      // Skip common ads/logos/trackers/social icons
      const adKeywords = [
        "ad-", "/ad/", "advertisement", "logo", "icon", "tracker", 
        "pixel", "banner", "avatar", "nav-", "header", "footer", 
        "button", "social-media", "facebook", "twitter", "linkedin",
        "instagram", "youtube", "tiktok", "pinterest", "whatsapp",
        "google", "favicon"
      ];
      
      if (adKeywords.some(keyword => lowerUrl.includes(keyword))) {
        continue;
      }
      
      // Keep only standard image formats
      if (!/\.(jpg|jpeg|png|webp|gif|svg|avif|bmp)($|\?)/i.test(lowerUrl) && !lowerUrl.startsWith("data:image/")) {
        continue;
      }
      
      if (!images.includes(absoluteUrl)) {
        images.push(absoluteUrl);
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  }
  return images;
}

function removeBoilerplateAndFooter(text: string): string {
  if (!text) return "";
  
  const boilerplatePatterns = [
    /enjoyed this\?/i,
    /beyond vibe coding/i,
    /o'reilly book/i,
    /addy osmani/i,
    /tweet\b/i,
    /bluesky\b/i,
    /mastodon\b/i,
    /threads\b/i,
    /subscribe to my free newsletter/i,
    /disclaimer:\s*the views and opinions/i,
    /do not necessarily reflect the views/i,
    /positions, or strategies of google/i,
  ];

  return text
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      return !boilerplatePatterns.some(pattern => pattern.test(trimmed));
    })
    .join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL structure
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (e) {
      return NextResponse.json({ error: "Invalid URL provided" }, { status: 400 });
    }

    const response = await fetch(targetUrl.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page content: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const cleanText = cleanHtmlToText(html);
    const filteredText = removeBoilerplateAndFooter(cleanText);
    const extractedImages = extractImages(html, targetUrl.href);

    // Limit text length to avoid overflow issues
    const maxTextLength = 20000;
    const truncatedText = filteredText.length > maxTextLength 
      ? filteredText.substring(0, maxTextLength) + "\n\n... (truncated)"
      : filteredText;

    return NextResponse.json({
      success: true,
      text: truncatedText,
      images: extractedImages.slice(0, 15) // Limit to top 15 images
    });
  } catch (error: any) {
    console.error("URL scraping failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to scrape content from URL" },
      { status: 500 }
    );
  }
}
