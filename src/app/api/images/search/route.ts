import { NextRequest, NextResponse } from "next/server";

async function fetchWikiImages(query: string) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=6&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.query && data.query.pages) {
      const pages = Object.values(data.query.pages);
      return pages
        .map((page: any) => {
          const info = page.imageinfo?.[0] || {};
          return {
            id: `wiki_${page.pageid || Math.random()}`,
            url: info.url,
            thumbnail: info.url,
            attribution: info.extmetadata?.Artist?.value || "Wikipedia Commons",
            source: "wikipedia",
          };
        })
        .filter((item: any) => item.url && /\.(jpe?g|png|gif|webp)$/i.test(item.url));
    }
  } catch (e) {
    console.warn("Wiki search failed:", e);
  }
  return [];
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query") || "business growth";

  const serperKey = process.env.SERPER_API_KEY;
  const serpapiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  let results: { id: string; url: string; thumbnail: string; attribution: string; source: string }[] = [];
  const promises = [];

  // 1. Google Images via Serper.dev (Free tier available)
  if (serperKey) {
    promises.push(
      fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: 6 }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.images) {
            return data.images.map((item: any, idx: number) => ({
              id: `google_serper_${idx}_${Date.now()}`,
              url: item.imageUrl,
              thumbnail: item.thumbnailUrl || item.imageUrl,
              attribution: `Photo from ${item.domain || item.source || "Google Search"}`,
              source: "google"
            }));
          }
          return [];
        })
        .catch(() => [])
    );
  }

  // 2. Google Images via SerpApi (Free tier available)
  if (serpapiKey) {
    promises.push(
      fetch(`https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&api_key=${serpapiKey}&num=6`)
        .then(res => res.json())
        .then(data => {
          if (data.images_results) {
            return data.images_results.map((item: any, idx: number) => ({
              id: `google_serpapi_${idx}_${Date.now()}`,
              url: item.original,
              thumbnail: item.thumbnail || item.original,
              attribution: `Photo from ${item.source || "Google Search"}`,
              source: "google"
            }));
          }
          return [];
        })
        .catch(() => [])
    );
  }

  // 3. Unsplash search
  if (unsplashKey) {
    promises.push(
      fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&per_page=6`)
        .then(res => res.json())
        .then(data => {
          if (data.results) {
            return data.results.map((item: any) => ({
              id: `unsplash_${item.id}`,
              url: item.urls.regular,
              thumbnail: item.urls.thumb,
              attribution: `Photo by ${item.user.name} on Unsplash`,
              source: "unsplash"
            }));
          }
          return [];
        })
        .catch(() => [])
    );
  }

  // 4. Pexels search
  if (pexelsKey) {
    promises.push(
      fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, {
        headers: { Authorization: pexelsKey }
      })
        .then(res => res.json())
        .then(data => {
          if (data.photos) {
            return data.photos.map((item: any) => ({
              id: `pexels_${item.id}`,
              url: item.src.large,
              thumbnail: item.src.tiny,
              attribution: `Photo by ${item.photographer} on Pexels`,
              source: "pexels"
            }));
          }
          return [];
        })
        .catch(() => [])
    );
  }

  // 5. DuckDuckGo Image Search (Free, keyless) with Wiki fallback
  promises.push(
    fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    })
      .then(res => res.text())
      .then(async html => {
        const vqdRegex = /vqd=['"]?([^'"]+)['"]?/;
        const match = html.match(vqdRegex);
        if (!match) return fetchWikiImages(query);
        const vqd = match[1];

        const imagesRes = await fetch(`https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`
          }
        });
        const imagesText = await imagesRes.text();
        if (imagesText.includes("anomalyDetectionBlock")) {
          return fetchWikiImages(query);
        }

        const data = JSON.parse(imagesText);
        if (data.results) {
          return data.results.slice(0, 6).map((item: any, idx: number) => ({
            id: `ddg_${idx}_${Date.now()}`,
            url: item.image,
            thumbnail: item.thumbnail || item.image,
            attribution: `Photo from ${item.source || "DuckDuckGo"}`,
            source: "duckduckgo"
          }));
        }
        return fetchWikiImages(query);
      })
      .catch(() => fetchWikiImages(query))
  );

  try {
    if (promises.length > 0) {
      const settled = await Promise.allSettled(promises);
      settled.forEach((p) => {
        if (p.status === "fulfilled" && p.value) {
          results = [...results, ...p.value];
        }
      });
    }
  } catch (err) {
    console.error("Parallel search fetch error:", err);
  }

  // Check if search returned results
  if (results.length === 0) {
    return NextResponse.json({ error: "Image search failed. No search results returned." }, { status: 400 });
  }

  return NextResponse.json({ success: true, results: results.slice(0, 12) });
}
