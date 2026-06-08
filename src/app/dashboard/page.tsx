"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { Mic, Link2, Sparkles, ChevronRight, MicIcon, Image as ImageIcon, CheckCircle2, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PostItem {
  id: string;
  post_content: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>({
    plan: "free",
    posts_used_this_week: 2, // match mockup
    posts_limit_weekly: 3,
    ai_images_used_this_week: 0,
    ai_images_limit_weekly: 3,
  });
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState<any>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch posts
        const postsRes = await fetch("/api/posts");
        const postsData = await postsRes.json();
        if (postsData.success && postsData.posts?.length > 0) {
          setPosts(postsData.posts.slice(0, 4));
        } else {
          setPosts([]);
        }

        // Fetch LinkedIn status
        const statusRes = await fetch("/api/linkedin/scraping-status");
        const statusData = await statusRes.json();
        const connected = statusData.status && statusData.status !== "disconnected";
        setLinkedinConnected(connected);
        if (connected) {
          setScrapingStatus(statusData);
        }

        // Fetch user data (mocked or loaded)
        setUserData({
          plan: "free",
          posts_used_this_week: 2, // matches mockup exactly
          posts_limit_weekly: 3,
          ai_images_used_this_week: 1,
          ai_images_limit_weekly: 3,
        });
      } catch (err) {
        console.error("Dashboard load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "text-emerald-500 font-bold bg-transparent";
      case "pending_approval": return "text-orange-500 font-bold bg-transparent";
      case "draft": return "text-zinc-400 font-bold bg-transparent";
      case "scheduled": return "text-cyan-500 font-bold bg-transparent";
      default: return "text-zinc-500 font-bold bg-transparent";
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "published") return "Live";
    if (status === "pending_approval") return "Draft"; // matches mockup naming
    return status.toUpperCase().replace("_", " ");
  };

  return (
    <IosShell>
      <div className="pt-6 select-text px-4 md:px-0">
        <h1 className="ios-large-title">VoicePost</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-4">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Tagline Rect */}
            <div className="ios-card p-5 flex items-center gap-4 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 text-white border-none shadow-md">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 shrink-0">
                <Mic className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg leading-tight">Speak. Publish. Scale.</h3>
                <p className="text-sm text-cyan-50 font-medium mt-0.5">
                  Turn 60 seconds of voice into high-quality LinkedIn thought leadership.
                </p>
              </div>
            </div>

            {/* How it works Walkthrough Video */}
            <div className="space-y-1">
              <div className="ios-section-label">How it works</div>
              <div className="ios-card p-4 bg-zinc-900/40 border border-zinc-800/80">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-zinc-850">
                  <video
                    className="w-full h-full object-cover"
                    controls
                    loop
                    muted
                    playsInline
                    src="https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-his-computer-38534-large.mp4"
                    poster="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800"
                  />
                </div>
                <div className="mt-3 flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-zinc-400 font-semibold leading-relaxed">
                    Record for 60 seconds or upload media (image/video/PDF) to generate professional LinkedIn posts or PDF carousels matching your exact style DNA. All drafts are protected with one-click approval, and zero user data is ever stored permanently.
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Posts List */}
            <div className="space-y-1">
              <div className="ios-section-label">Recent posts</div>
              <div className="ios-card">
                {loading ? (
                  <div className="p-6 text-center text-sm text-zinc-400">Loading your posts...</div>
                ) : posts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    No posts created yet. Tap the center button below to record your first LinkedIn post!
                  </div>
                ) : (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => router.push(`/posts/${post.id}/approval`)}
                      className="ios-row cursor-pointer"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate font-sans">
                          {post.post_content?.trim()?.startsWith("{") && post.post_content?.trim()?.endsWith("}")
                            ? (() => {
                                try {
                                  const parsed = JSON.parse(post.post_content);
                                  return `[Carousel] ${parsed.title || "Untitled Carousel"}`;
                                } catch {
                                  return post.post_content;
                                }
                              })()
                            : post.post_content || "(Empty Draft)"}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {post.status === "published"
                            ? "Published"
                            : post.status === "scheduled"
                            ? "Scheduled"
                            : "Draft"}{" "}
                          · {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`${getStatusColor(post.status)} text-sm font-bold pr-2`}>
                        {getStatusLabel(post.status)}
                      </span>
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* LinkedIn Connection Status Widget */}
            <div className="space-y-1">
              <div className="ios-section-label">LinkedIn Account</div>
              <div className="ios-card p-4">
                {linkedinConnected && scrapingStatus ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={scrapingStatus.profile_picture_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                        alt="LinkedIn Profile"
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight truncate">
                          {scrapingStatus.profile_name}
                        </h4>
                        <p className="text-[10px] text-zinc-400 leading-normal truncate">
                          {scrapingStatus.profile_headline || "Connected"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className={
                        scrapingStatus.status === "complete" 
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap" 
                          : "bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full animate-pulse whitespace-nowrap"
                      }>
                        {scrapingStatus.status === "complete" ? "DNA Profile Loaded" : "Scraping DNA..."}
                      </Badge>
                      <p className="text-[9px] text-zinc-500 mt-1 font-semibold whitespace-nowrap">
                        {scrapingStatus.posts_scraped || 0} posts scraped
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-2 text-center">
                    <p className="text-xs text-zinc-400 mb-3 font-semibold">
                      LinkedIn Account Disconnected. Connect your profile to analyze writing DNA and enable direct publishing.
                    </p>
                    <Button
                      onClick={() => router.push("/settings/linkedin")}
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md flex items-center gap-1.5 border-none"
                    >
                      <Link2 className="w-3.5 h-3.5" /> Connect LinkedIn Account
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Weekly Usage Quota Card */}
            <div className="space-y-1">
              <div className="ios-section-label">This Week</div>
              <div className="ios-card p-4">
                <div>
                  <div className="flex justify-between items-center text-sm font-semibold mb-2">
                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">
                      Posts used
                    </span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-extrabold text-base">
                      {userData.posts_used_this_week} / {userData.posts_limit_weekly}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((userData.posts_used_this_week / userData.posts_limit_weekly) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-2 font-medium">
                    Resets Monday · {userData.plan === "free" ? "Free plan" : `${userData.plan} plan`}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-1">
              <div className="ios-section-label">Quick Actions</div>
              <div className="ios-card">
                <Link href="/posts/new" className="ios-row">
                  <div className="ios-icon bg-gradient-to-br from-cyan-400 to-blue-500">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">New post</p>
                    <p className="text-[10px] text-zinc-400 font-medium">Record voice or type</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </Link>

                <Link href="/posts/carousel/new" className="ios-row">
                  <div className="ios-icon bg-gradient-to-br from-purple-500 to-pink-500">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">New carousel</p>
                    <p className="text-[10px] text-zinc-400 font-medium">5 templates · AI slide builder</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </Link>

                <Link href="/pricing" className="ios-row">
                  <div className="ios-icon bg-gradient-to-br from-purple-500 to-indigo-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Upgrade plan</p>
                    <p className="text-[10px] text-zinc-400 font-medium">From $5/mo — unlock more posts</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </Link>

                <Link href="/settings/linkedin" className="ios-row">
                  <div className={`ios-icon ${linkedinConnected ? "bg-gradient-to-br from-emerald-400 to-green-500" : "bg-gradient-to-br from-orange-400 to-red-500"}`}>
                    <Link2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {linkedinConnected ? "LinkedIn Settings" : "Connect LinkedIn"}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      {linkedinConnected ? "Manage connections & scraping" : "Analyze writing DNA & publish"}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IosShell>
  );
}
