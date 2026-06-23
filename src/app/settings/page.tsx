"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { Link2, Shield, CreditCard, LayoutGrid, ChevronRight, Sparkles, LogOut, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>({
    full_name: "John Doe",
    email: "demo@voicepost.com",
    plan: "free",
    posts_used_this_week: 0,
    posts_limit_weekly: 3,
  });
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [styleProfile, setStyleProfile] = useState<any>(null);
  const [postsScraped, setPostsScraped] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBackend, setAiBackend] = useState<"antigravity" | "waterfall">("antigravity");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("voicepost_ai_backend");
    if (saved === "waterfall" || saved === "antigravity") {
      setAiBackend(saved);
    }
    setIsAdmin(localStorage.getItem("voicepost_is_admin") === "true");
  }, []);

  useEffect(() => {
    async function loadSettingsData() {
      try {
        // Load real session user
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();

        const postsRes = await fetch("/api/posts");
        const postsData = await postsRes.json();

        const statusRes = await fetch("/api/linkedin/scraping-status");
        const statusData = await statusRes.json();
        const connected = statusData.status && statusData.status !== "disconnected";
        setLinkedinConnected(connected);
        setPostsScraped(statusData.posts_scraped ?? 0);

        if (connected) {
          // Fetch style profile
          const profileRes = await fetch("/api/style/profile");
          if (profileRes.ok) {
            const pData = await profileRes.json();
            if (pData.success && pData.profile) {
              setStyleProfile(pData.profile);
            }
          }
        }

        const plan = sessionData.user?.plan || "free";
        const isFree = plan === "free";

        // Calculate posts created this week (since last Monday)
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const lastMonday = new Date(now.setDate(diff));
        lastMonday.setHours(0, 0, 0, 0);

        const postsThisWeek = postsData.posts?.filter((p: any) => {
          const postDate = new Date(p.created_at);
          return postDate >= lastMonday;
        }).length || 0;

        // Calculate posts created this month
        const postsThisMonth = postsData.posts?.filter((p: any) => {
          const postDate = new Date(p.created_at);
          const current = new Date();
          return postDate.getMonth() === current.getMonth() && postDate.getFullYear() === current.getFullYear();
        }).length || 0;

        const postsUsedCount = isFree ? postsThisWeek : postsThisMonth;
        const postsLimitVal = isFree 
          ? (sessionData.user?.posts_limit_weekly || 3) 
          : (sessionData.user?.posts_limit_monthly || 60);

        const email = sessionData.user?.email || "demo@voicepost.com";
        const ADMIN_EMAILS = ["vikram.bala@digitalfoundry.ai", "vikrambalauae.aj@gmail.com"];
        const isRealAdmin = ADMIN_EMAILS.includes(email);
        setIsAdmin(isRealAdmin);

        setUser({
          full_name: sessionData.user?.name || statusData.profile_name || "John Doe",
          email: email,
          picture: sessionData.user?.picture || statusData.profile_picture_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120",
          plan: plan,
          posts_used_this_week: postsUsedCount,
          posts_limit_weekly: postsLimitVal,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadSettingsData();
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleStripePortal = () => {
    alert("Redirecting to your secure Stripe Customer Billing Portal...");
    window.open("https://billing.stripe.com/session/demo", "_blank");
  };

  return (
    <IosShell>
      <div className="pt-6">
        <h1 className="ios-large-title">Profile</h1>

        {/* Profile Card Header */}
        <div className="ios-card p-5 flex items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50">
          <Avatar className="w-16 h-16 border border-zinc-200">
            <AvatarImage src={user.picture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"} alt="Avatar" />
            <AvatarFallback>{user.full_name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white leading-tight truncate">
              {user.full_name}
            </h3>
            <p className="text-sm text-zinc-400 font-medium mt-0.5 truncate">{user.email}</p>
            <div className="mt-2 flex items-center">
              <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                {user.plan} plan
              </Badge>
            </div>
          </div>
        </div>

        {/* Writing Style DNA Section */}
        {linkedinConnected && (
          <>
            <div className="ios-section-label">Writing Style DNA</div>
            {postsScraped === 0 || !styleProfile || styleProfile.posts_analyzed_count === 0 ? (
              <div className="ios-card p-5 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 space-y-2 text-center">
                <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">No post</h4>
                <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-xs mx-auto">
                  No LinkedIn posts have been scraped yet. Write some posts on LinkedIn or click &quot;Manage LinkedIn Integration&quot; below to trigger re-analysis.
                </p>
              </div>
            ) : (
              <div className="ios-card p-5 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 space-y-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">DNA Style Summary</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans font-medium">
                    {styleProfile.style_json?.writing_style_explanation || "No style summary generated yet."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Tone</p>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize mt-0.5">
                      {styleProfile.style_json?.tone_descriptor || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Sentence Style</p>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {styleProfile.style_json?.sentence_length_pattern || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Your Plan Benefits Section */}
        <div className="ios-section-label">Your Plan Benefits</div>
        <div className="ios-card p-4 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50">
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-semibold">Post Quota</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {user.plan === "free" ? "3 posts / week" : user.plan === "starter" ? "15 posts / month" : user.plan === "pro" ? "60 posts / month" : "Unlimited posts"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
              <span className="text-zinc-400 font-semibold">LinkedIn Accounts</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {user.plan === "free" || user.plan === "starter" ? "1 Account" : user.plan === "pro" ? "3 Accounts" : "10 Accounts"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
              <span className="text-zinc-400 font-semibold">Writing Styles</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {user.plan === "free" ? "Personal + 3 Expert" : user.plan === "starter" ? "All Expert + Custom Builder" : "All Styles + Blending"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
              <span className="text-zinc-400 font-semibold">Scheduled Posting</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {user.plan === "free" || user.plan === "starter" ? "Unavailable" : "Included (Pro)"}
              </span>
            </div>
          </div>
        </div>

        {/* Settings Rows */}
        <div className="ios-section-label">Account settings</div>
        <div className="ios-card">
          <div onClick={() => router.push("/settings/linkedin")} className="ios-row">
            <div className="ios-icon bg-blue-500">
              <Link2 className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold flex-1 text-zinc-800 dark:text-zinc-200">
              Manage LinkedIn Integration
            </span>
            <div className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full ${linkedinConnected ? "bg-green-500" : "bg-orange-500"}`} />
              <span className="text-xs text-zinc-400 mr-1">
                {linkedinConnected ? "Connected" : "Not Linked"}
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </div>

          <div onClick={handleStripePortal} className="ios-row">
            <div className="ios-icon bg-emerald-500">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold flex-1 text-zinc-800 dark:text-zinc-200">
              Billing & Invoices
            </span>
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </div>

          {isAdmin && (
            <div className="ios-row cursor-default">
              <div className="ios-icon bg-purple-500">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold flex-1 text-zinc-800 dark:text-zinc-200">
                AI Generation Engine
              </span>
              <select
                value={aiBackend}
                onChange={(e) => {
                  const val = e.target.value as "antigravity" | "waterfall";
                  setAiBackend(val);
                  localStorage.setItem("voicepost_ai_backend", val);
                }}
                className="bg-transparent text-xs font-bold text-zinc-500 outline-none cursor-pointer border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-0.5"
              >
                <option value="antigravity">Advanced AI Agent</option>
                <option value="waterfall">Standard LLM</option>
              </select>
            </div>
          )}
        </div>

        <div className="ios-section-label">{isAdmin ? "Privacy & Admin" : "Privacy & Safety"}</div>
        <div className="ios-card">
          {isAdmin && (
            <div onClick={() => router.push("/admin")} className="ios-row">
              <div className="ios-icon bg-zinc-700">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold flex-1 text-zinc-800 dark:text-zinc-200">
                Admin Console (Logs view)
              </span>
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </div>
          )}

          <div
            onClick={() =>
              alert(
                "Triple-Layer Privacy Policy:\n1. Scraped raw LinkedIn history is encrypted.\n2. Audio and transcripts are RLS-hidden from administrators.\n3. Zero data is shared outside your account."
              )
            }
            className="ios-row"
          >
            <div className="ios-icon bg-purple-500">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold flex-1 text-zinc-800 dark:text-zinc-200">
              Privacy & Encryption Policy
            </span>
            <ChevronRight className="w-5 h-5 text-zinc-400" />
          </div>
        </div>

        {/* Sign Out */}
        <div className="ios-section-label">Account</div>
        <div className="ios-card">
          <button
            onClick={handleSignOut}
            className="ios-row w-full text-left"
          >
            <div className="ios-icon bg-red-500">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold flex-1 text-red-500">
              Sign Out
            </span>
          </button>
        </div>

        {/* App Version Info */}
        <p className="text-center text-xs text-zinc-400 mt-4 select-none">
          VoicePost v1.3.1 · <span className="text-zinc-600">{user.email}</span>
        </p>
      </div>
    </IosShell>
  );
}
