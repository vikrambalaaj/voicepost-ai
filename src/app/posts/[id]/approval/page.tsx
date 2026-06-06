"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { ArrowLeft, Check, AlertTriangle, Plus, X, Clock, HelpCircle, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ApprovalPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [post, setPost] = useState<any>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [voice, setVoice] = useState<any>(null);
  const [linkedAccount, setLinkedAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit States
  const [postContent, setPostContent] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState("");
  const [showAddHash, setShowAddHash] = useState(false);

  // Feedback State
  const [feedback, setFeedback] = useState("");
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Scheduling State
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  // Publish States
  const [publishing, setPublishing] = useState(false);

  // Load Data
  useEffect(() => {
    async function loadPostData() {
      try {
        const res = await fetch(`/api/posts/${id}`);
        const data = await res.json();
        if (data.success) {
          setPost(data.post);
          setPostContent(data.post.post_content || "");
          setHashtags(data.post.hashtags || []);
          setRevisions(data.revisions || []);
          setImages(data.images || []);
          setVoice(data.voice || null);
        }

        // Load connected LinkedIn account
        const accRes = await fetch("/api/linkedin/scraping-status");
        const accData = await accRes.json();
        if (accData.status && accData.status !== "disconnected") {
          setLinkedAccount(accData);
        }
      } catch (err) {
        console.error("Failed to load approval package:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPostData();
  }, [id]);

  // Handle Hashtag management
  const handleRemoveHash = (idx: number) => {
    setHashtags(hashtags.filter((_, i) => i !== idx));
  };

  const handleAddHash = () => {
    if (newHashtag.trim()) {
      let clean = newHashtag.trim().replace(/^#/, "");
      setHashtags([...hashtags, clean]);
      setNewHashtag("");
      setShowAddHash(false);
    }
  };

  // Handle Approve & Publish
  const handlePublish = async () => {
    setPublishing(true);
    try {
      // 1. Save inline changes first
      await fetch(`/api/posts`, {
        method: "POST", // updates or edits
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_content: postContent, hashtags }),
      });

      // 2. Schedule or Publish now
      if (scheduleMode === "schedule" && scheduledAt) {
        const approveRes = await fetch(`/api/posts/${id}/approve`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_at: scheduledAt }),
        });
        const approveData = await approveRes.json();
        if (approveData.success) {
          alert("Post scheduled successfully!");
          router.push("/dashboard");
        }
      } else {
        // Publish Now
        const selectedBackend = localStorage.getItem("voicepost_ai_backend") || "antigravity";
        const pubRes = await fetch(`/api/posts/${id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backend: selectedBackend }),
        });
        const pubData = await pubRes.json();
        
        if (pubRes.status === 403 && pubData.limit_hit) {
          // Show Limit Hit modal details
          alert(`${pubData.title}: ${pubData.body}`);
          router.push("/pricing");
        } else if (pubData.success) {
          alert("Successfully published to LinkedIn!");
          router.push("/dashboard");
        } else if (pubData.pending_review) {
          // LinkedIn review fallback
          alert(pubData.message);
          navigator.clipboard.writeText(pubData.post_content + "\n\n" + pubData.hashtags.map((h: string) => `#${h}`).join(" "));
          window.open("https://www.linkedin.com/", "_blank");
          router.push("/dashboard");
        } else {
          alert("Publish failed: " + pubData.error);
        }
      }
    } catch (e: any) {
      console.error(e);
      alert("An error occurred: " + e.message);
    } finally {
      setPublishing(false);
    }
  };

  // Handle Request Changes / Regenerate
  const handleRegenerate = async () => {
    if (!feedback.trim()) {
      alert("Please enter what needs to change.");
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/content/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: id, feedback }),
      });
      const data = await res.json();
      if (data.success) {
        setPostContent(data.approval_package.post_content);
        setHashtags(data.approval_package.hashtags);
        setFeedback("");
        setShowFeedbackInput(false);
        // Refresh revisions
        const revRes = await fetch(`/api/posts/${id}`);
        const revData = await revRes.json();
        if (revData.success) {
          setRevisions(revData.revisions);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <IosShell>
        <div className="flex items-center justify-center min-h-[50vh] text-sm text-zinc-400">
          Loading Approval Package...
        </div>
      </IosShell>
    );
  }

  const activeImage = images.find((img) => img.is_selected) || images[0];
  const lastRevision = revisions[0] || {};

  return (
    <IosShell>
      <div className="pt-6 px-4">
        {/* iOS Nav Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="ios-back-btn">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <span className="font-semibold text-zinc-900 dark:text-white text-base">Approval Package</span>
          <div className="w-12" />
        </div>

        {/* AI Model Badge Info */}
        {lastRevision.provider_used && (
          <div className="ios-card bg-zinc-100 dark:bg-zinc-800/40 p-3 flex justify-between items-center text-xs text-zinc-500 font-medium">
            <span>Powered by {lastRevision.provider_used} ({lastRevision.model_used})</span>
            <span>Latency: {((lastRevision.latency_ms || 1000) / 1000).toFixed(1)}s</span>
          </div>
        )}

        {/* Agent Chain of Thought */}
        {post?.agent_thoughts && (
          <div className="ios-card bg-purple-500/5 border border-purple-500/20 p-4 mb-4 select-text">
            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
              <Sparkles className="w-3.5 h-3.5" /> Agent Chain-of-Thought Logs
            </h4>
            <div className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
              {post.agent_thoughts}
            </div>
          </div>
        )}

        {/* LinkedIn Preview Card */}
        <div className="ios-section-label">LinkedIn Layout Preview</div>
        <div className="ios-card bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-4 shadow-sm">
          {/* Header */}
          <div className="flex gap-3 mb-3">
            <img
              src={linkedAccount?.profile_picture_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
              alt="Profile"
              className="w-11 h-11 rounded-full object-cover border border-zinc-200"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                {linkedAccount?.profile_name || "John Doe"}
              </h4>
              <p className="text-xs text-zinc-500 truncate">
                {linkedAccount?.profile_headline || "Tech Founder & AI Creator"}
              </p>
              <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                Just now • 🌐
              </p>
            </div>
          </div>

          {/* Edit Inline Box */}
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            className="w-full text-sm text-zinc-800 dark:text-zinc-200 bg-transparent border-none focus:outline-none resize-none leading-relaxed placeholder:text-zinc-400 mb-2 h-44"
            placeholder="Write your post here..."
          />

          {/* Hashtags display */}
          <div className="text-blue-600 dark:text-blue-400 text-sm font-semibold mb-3 flex flex-wrap gap-1">
            {hashtags.map((tag) => `#${tag} `)}
          </div>

          {/* Selected Image */}
          {activeImage && (
            <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-video mb-3 bg-zinc-100">
              <img src={activeImage.url} alt="Post asset" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Footer LinkedIn Actions mockup */}
          <div className="flex justify-around border-t dark:border-zinc-800 pt-3 text-xs text-zinc-500 font-bold select-none">
            <span>👍 Like</span>
            <span>💬 Comment</span>
            <span>🔁 Repost</span>
            <span>✉️ Send</span>
          </div>
        </div>

        {/* Style Match & Score */}
        <div className="ios-section-label">Style Metrics</div>
        <div className="ios-card p-4 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Writing DNA Match</span>
          <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-bold rounded-full text-xs px-2.5 py-0.5">
            {post?.style_match_score || 8}/10 Match
          </Badge>
        </div>

        {/* Hashtags Editor */}
        <div className="ios-section-label">Manage Hashtags</div>
        <div className="ios-card p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {hashtags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50"
              >
                #{tag}
                <button onClick={() => handleRemoveHash(idx)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <button
              onClick={() => setShowAddHash(!showAddHash)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-500 hover:text-zinc-700"
            >
              <Plus className="w-3.5 h-3.5" /> Add tag
            </button>
          </div>

          {showAddHash && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                placeholder="marketing"
                className="flex-1 text-xs p-2.5 rounded-xl border bg-transparent focus:outline-none"
              />
              <Button onClick={handleAddHash} className="rounded-xl px-4 text-xs h-9 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-white">
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Scheduling Options */}
        <div className="ios-section-label">Scheduling</div>
        <div className="ios-card p-4">
          <div className="ios-segment mb-4">
            <button
              onClick={() => setScheduleMode("now")}
              className={`ios-segment-btn ${scheduleMode === "now" ? "active" : ""}`}
            >
              Post now
            </button>
            <button
              onClick={() => setScheduleMode("schedule")}
              className={`ios-segment-btn ${scheduleMode === "schedule" ? "active" : ""}`}
            >
              Schedule
            </button>
          </div>

          {scheduleMode === "schedule" && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Select Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full p-3 rounded-xl border bg-transparent text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="py-4 space-y-3">
          {showFeedbackInput ? (
            <div className="ios-card p-4 space-y-3 bg-red-50/20 dark:bg-red-950/10 border border-red-500/20">
              <label className="text-xs font-bold text-red-500 dark:text-red-400 uppercase">What needs to change?</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Example: Make it shorter. Make the opener more interesting. Add bullet points..."
                className="w-full h-24 p-3 rounded-xl border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 font-bold border-none cursor-pointer text-xs"
                >
                  {regenerating ? "Regenerating..." : "Submit feedback"}
                </button>
                <Button
                  onClick={() => setShowFeedbackInput(false)}
                  variant="outline"
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="w-[calc(100%-32px)] mx-4 my-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-850 disabled:text-zinc-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md border-none text-[17px] font-semibold cursor-pointer transition-all duration-200"
              >
                {publishing ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {scheduleMode === "schedule" ? "Approve & Schedule" : "Approve & Publish"}
                  </>
                )}
              </button>

              <button
                onClick={() => setShowFeedbackInput(true)}
                className="w-[calc(100%-32px)] mx-4 my-2 bg-transparent hover:bg-red-500/10 text-red-500 hover:text-red-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 border border-red-500/30 text-[17px] font-semibold cursor-pointer transition-all duration-200"
              >
                Request changes
              </button>
            </>
          )}
        </div>

        {/* Changelog Accordion */}
        <div className="ios-section-label">Revision History</div>
        <div className="ios-card p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
          {revisions.length === 0 ? (
            <p className="text-xs text-zinc-500">No revisions logged yet.</p>
          ) : (
            revisions.map((rev, idx) => (
              <div key={rev.id} className="border-l-2 border-blue-500 pl-3 space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>Revision #{rev.revision_number}</span>
                  <span className="text-zinc-400 font-normal">
                    {new Date(rev.created_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {rev.feedback_given && (
                  <p className="text-xs text-zinc-400 font-medium italic">
                    Feedback: &ldquo;{rev.feedback_given}&rdquo;
                  </p>
                )}
                {rev.changes_made && rev.changes_made.length > 0 && (
                  <p className="text-[10px] text-zinc-500">
                    Changes: {rev.changes_made.join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </IosShell>
  );
}
