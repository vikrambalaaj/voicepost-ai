"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { 
  Search, Sparkles, TrendingUp, Cpu, Users, Briefcase, 
  BrainCircuit, Target, Heart, ExternalLink, ArrowRight, Lightbulb 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrendTopic {
  rank: number;
  topic: string;
  summary: string;
  suggested_angle: string;
  momentum: number;
  sources?: string[];
}

export default function InspirationPage() {
  const router = useRouter();
  const [topicInput, setTopicInput] = useState("");
  const [activeTopic, setActiveTopic] = useState("AI");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [error, setError] = useState("");

  const presets = [
    { name: "AI", icon: Cpu, color: "from-purple-500 to-indigo-500" },
    { name: "Hacker News", icon: Lightbulb, color: "from-orange-500 to-amber-500" },
    { name: "Leadership", icon: Users, color: "from-blue-500 to-cyan-500" },
    { name: "SAP", icon: Briefcase, color: "from-amber-500 to-orange-500" },
    { name: "Data", icon: BrainCircuit, color: "from-teal-500 to-emerald-500" },
    { name: "Motivation", icon: Target, color: "from-rose-500 to-pink-500" },
    { name: "Office Relationship", icon: Heart, color: "from-violet-500 to-purple-500" }
  ];

  const fetchTrends = async (topic: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/trends/search?topic=${encodeURIComponent(topic)}`);
      const data = await res.json();
      if (data.success) {
        setTrends(data.trends || []);
      } else {
        setError(data.error || "Failed to load trends.");
      }
    } catch (err) {
      setError("An unexpected error occurred while fetching trends.");
    } finally {
      setLoading(false);
    }
  };

  // Load default topic on mount
  useEffect(() => {
    fetchTrends("AI");
  }, []);

  const handlePresetClick = (name: string) => {
    setActiveTopic(name);
    setTopicInput("");
    fetchTrends(name);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    setActiveTopic(topicInput.trim());
    fetchTrends(topicInput.trim());
  };

  const handleCreatePost = (trend: TrendTopic) => {
    const defaultText = `TRENDING TOPIC:\n${trend.topic}\n\nSUGGESTED ANGLE:\n${trend.suggested_angle}`;
    router.push(`/posts/new?idea=${encodeURIComponent(defaultText)}`);
  };

  return (
    <IosShell>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:p-8 space-y-8 pb-24 select-none">
        
        {/* Header Block */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Lightbulb className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Content Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Inspiration Feed
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-lg">
            Search trending topics from X and Reddit in real-time. Discover actionable insights and post templates to write high-performing content.
          </p>
        </div>

        {/* Search and Category Presets */}
        <div className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Enter any topic (e.g. Fintech, Remote Work, Cybersecurity)..."
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                className="w-full text-sm pl-10 pr-4 py-3 rounded-2xl border bg-zinc-900/40 backdrop-blur border-zinc-800 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="rounded-2xl px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-500/10 transition-all cursor-pointer select-none active:scale-98"
            >
              Find Trends
            </button>
          </form>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const isActive = activeTopic.toLowerCase() === preset.name.toLowerCase();
              return (
                <button
                  key={preset.name}
                  onClick={() => handlePresetClick(preset.name)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isActive 
                      ? "bg-zinc-800 border-zinc-700 text-white shadow-inner" 
                      : "bg-zinc-900/30 border-zinc-850 text-zinc-400 hover:text-white hover:bg-zinc-800/40 hover:border-zinc-800"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${preset.color} ${isActive ? "animate-pulse" : ""}`} />
                  <Icon className="w-3.5 h-3.5" />
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
            <h3 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              Latest Trends for <span className="text-purple-400 capitalize">"{activeTopic}"</span>
            </h3>
            {trends.length > 0 && (
              <span className="text-[10px] text-zinc-500 font-semibold font-mono">
                Updated just now
              </span>
            )}
          </div>

          {error && (
            <div className="ios-card bg-red-500/5 border border-red-500/10 p-4 text-center">
              <p className="text-xs text-red-400 font-medium">{error}</p>
              <Button onClick={() => fetchTrends(activeTopic)} variant="outline" className="mt-3 text-xs border-zinc-800">
                Retry Fetch
              </Button>
            </div>
          )}

          {loading ? (
            /* Loading Skeleton */
            <div className="grid grid-cols-1 gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="ios-card p-5 space-y-4 animate-pulse border border-zinc-850 bg-zinc-900/20">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-zinc-800 rounded w-1/3" />
                    <div className="h-5 bg-zinc-800 rounded w-20" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-zinc-800 rounded w-full" />
                    <div className="h-3 bg-zinc-800 rounded w-5/6" />
                  </div>
                  <div className="h-16 bg-zinc-800/40 rounded-xl" />
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-zinc-800 rounded w-24" />
                    <div className="h-8 bg-zinc-800 rounded w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Actual Results */
            <div className="grid grid-cols-1 gap-4">
              {trends.length === 0 && !error ? (
                <div className="ios-card bg-zinc-900/10 border border-zinc-850 p-8 text-center text-zinc-500 text-xs font-medium">
                  No trending topics discovered. Try searching another term!
                </div>
              ) : (
                trends.map((trend) => (
                  <div 
                    key={trend.rank}
                    className="ios-card bg-zinc-900/20 border border-zinc-850 hover:border-zinc-800 p-5 space-y-4 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/[0.02]"
                  >
                    {/* Topic Header & Momentum */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/10 mr-2">
                          #{trend.rank}
                        </span>
                        <h4 className="inline text-sm font-extrabold text-white leading-snug">
                          {trend.topic}
                        </h4>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/10">
                          {trend.momentum}% Momentum
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                      {trend.summary}
                    </p>

                    {/* Suggested Post Angle */}
                    <div className="bg-purple-950/10 border border-purple-500/10 rounded-2xl p-4 space-y-1.5 select-text">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-purple-400 tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Suggested Hook & Angle
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed font-normal select-text">
                        "{trend.suggested_angle}"
                      </p>
                    </div>

                    {/* Sources & Create Action */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-zinc-850/60">
                      {/* Sources */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mr-1">
                          Sources:
                        </span>
                        {trend.sources && trend.sources.length > 0 ? (
                          trend.sources.map((src, i) => (
                            <a 
                              key={i}
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white bg-zinc-850 hover:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-800 transition-colors"
                            >
                              <span>{src.includes("reddit.com") ? "Reddit Discussion" : "Web Source"}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                            </a>
                          ))
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-semibold italic">Reddit & X Social Channels</span>
                        )}
                      </div>

                      {/* Write Button */}
                      <button
                        onClick={() => handleCreatePost(trend)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-white text-xs font-bold border border-zinc-800 cursor-pointer active:scale-98 transition-all w-full sm:w-auto"
                      >
                        <span>Write Post</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </IosShell>
  );
}
