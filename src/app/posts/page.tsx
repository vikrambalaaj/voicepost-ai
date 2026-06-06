"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { ChevronRight, ExternalLink, FileText, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PostItem {
  id: string;
  post_content: string;
  status: string;
  created_at: string;
  scheduled_at?: string;
  published_at?: string;
  linkedin_post_url?: string;
}

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<"drafts" | "scheduled" | "published">("drafts");

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch("/api/posts");
        const data = await response.json();
        if (data.success) {
          setPosts(data.posts);
        }
      } catch (err) {
        console.error("Failed to load posts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  const getFilteredPosts = () => {
    switch (activeSegment) {
      case "published":
        return posts.filter((p) => p.status === "published");
      case "scheduled":
        return posts.filter((p) => p.status === "scheduled");
      case "drafts":
      default:
        return posts.filter((p) => ["draft", "generating", "pending_approval", "rejected", "failed"].includes(p.status));
    }
  };

  const getPostIcon = (status: string) => {
    switch (status) {
      case "published": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "scheduled": return <Calendar className="w-5 h-5 text-blue-500" />;
      case "failed": return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <FileText className="w-5 h-5 text-zinc-400" />;
    }
  };

  const filteredPosts = getFilteredPosts();

  return (
    <IosShell>
      <div className="pt-6">
        <h1 className="ios-large-title">Posts</h1>

        {/* iOS Segmented Control */}
        <div className="ios-segment">
          <button
            onClick={() => setActiveSegment("drafts")}
            className={`ios-segment-btn ${activeSegment === "drafts" ? "active" : ""}`}
          >
            Drafts
          </button>
          <button
            onClick={() => setActiveSegment("scheduled")}
            className={`ios-segment-btn ${activeSegment === "scheduled" ? "active" : ""}`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setActiveSegment("published")}
            className={`ios-segment-btn ${activeSegment === "published" ? "active" : ""}`}
          >
            Published
          </button>
        </div>

        {/* List of Posts */}
        <div className="ios-card">
          {loading ? (
            <div className="p-6 text-center text-sm text-zinc-400">Loading your posts...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              No {activeSegment} posts found.
            </div>
          ) : (
            filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => router.push(`/posts/${post.id}/approval`)}
                className="ios-row"
              >
                {getPostIcon(post.status)}
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {post.post_content || "(Empty Draft)"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {activeSegment === "published" && post.published_at
                      ? `Published on ${new Date(post.published_at).toLocaleDateString()}`
                      : activeSegment === "scheduled" && post.scheduled_at
                      ? `Scheduled for ${new Date(post.scheduled_at).toLocaleDateString()}`
                      : `Created on ${new Date(post.created_at).toLocaleDateString()}`}
                  </p>
                </div>

                {activeSegment === "published" && post.linkedin_post_url ? (
                  <a
                    href={post.linkedin_post_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-zinc-400 hover:text-blue-500 active:opacity-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </IosShell>
  );
}
