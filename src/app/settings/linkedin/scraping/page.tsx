"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { BarChart2, CheckCircle2, AlertTriangle, Sparkles, Loader } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ScrapingProgressPage() {
  const router = useRouter();
  const [status, setStatus] = useState("running");
  const [postsCount, setPostsCount] = useState(0);
  const [traits, setTraits] = useState<string[]>([]);
  const [percent, setPercent] = useState(20);

  useEffect(() => {
    let completeTimer: NodeJS.Timeout | null = null;
    
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/linkedin/scraping-status");
        const data = await res.json();
        
        if (data.status) {
          setStatus(data.status);
          setPostsCount(data.posts_scraped || 0);
          setTraits(data.style_traits || []);

          if (data.status === "complete") {
            setPercent(100);
            clearInterval(pollInterval);
            
            // Redirect after 2s delay
            completeTimer = setTimeout(() => {
              router.push("/dashboard");
            }, 2000);
          } else {
            // Incremental mockup percentage up to 90%
            setPercent((prev) => Math.min(prev + 15, 90));
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [router]);

  return (
    <IosShell>
      <div className="pt-12 px-4 flex flex-col items-center text-center max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 mb-6 animate-pulse border border-blue-500/20">
          <Loader className="w-10 h-10 animate-spin" />
        </div>

        <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-2">
          Analyzing writing history
        </h2>
        <p className="text-sm text-zinc-500 mb-6">
          We found <span className="font-bold text-zinc-800 dark:text-zinc-200">{postsCount} posts</span> so far.
        </p>

        {/* Progress Bar Container */}
        <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-3 rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Dynamic style chips as they load */}
        {traits.length > 0 && (
          <div className="w-full space-y-3 mb-8">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-left pl-1">
              Detected Style Traits:
            </h4>
            <div className="flex flex-wrap gap-2 justify-start select-none">
              {traits.map((trait, idx) => (
                <Badge
                  key={idx}
                  className="bg-blue-600/10 text-blue-600 border border-blue-500/20 hover:bg-blue-600/10 font-semibold px-3 py-1.5 rounded-full text-xs animate-bounce"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 inline" /> {trait}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Helper bottom text */}
        <div className="p-4 bg-zinc-100 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 w-full text-xs text-zinc-500 font-medium leading-relaxed">
          Analysis runs in the background. You can start creating drafts now using Expert styles.
        </div>
      </div>
    </IosShell>
  );
}
