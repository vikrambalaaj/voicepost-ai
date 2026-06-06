"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IosShell } from "@/components/layout/IosShell";
import { ArrowLeft, CheckCircle2, AlertTriangle, Link2, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LinkedInSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  // Style profile states
  const [styleProfile, setStyleProfile] = useState<any>(null);
  const [isEditingStyle, setIsEditingStyle] = useState(false);
  const [editedTone, setEditedTone] = useState("");
  const [editedLength, setEditedLength] = useState(120);
  const [editedSentencePattern, setEditedSentencePattern] = useState("");
  const [editedCta, setEditedCta] = useState("");
  const [editedPhrases, setEditedPhrases] = useState("");
  const [editedAvoided, setEditedAvoided] = useState("");
  const [editedSample, setEditedSample] = useState("");
  const [savingStyle, setSavingStyle] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/linkedin/scraping-status");
        const data = await res.json();
        if (data.status && data.status !== "disconnected") {
          setAccount(data);
          
          // Fetch style profile
          const profileRes = await fetch("/api/style/profile");
          if (profileRes.ok) {
            const pData = await profileRes.json();
            if (pData.success && pData.profile) {
              const prof = pData.profile;
              setStyleProfile(prof);
              const sj = prof.style_json || {};
              setEditedTone(sj.tone_descriptor || "");
              setEditedLength(sj.avg_post_length_words || 120);
              setEditedSentencePattern(sj.sentence_length_pattern || "");
              setEditedCta(sj.cta_style || "");
              setEditedPhrases((sj.frequently_used_phrases || []).join(", "));
              setEditedAvoided((sj.avoided_corporate_words || []).join(", "));
              setEditedSample(prof.sample_post || "");
            }
          }
        } else {
          setAccount(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  const handleConnect = () => {
    // Redirect to LinkedIn OAuth API route
    router.push("/api/auth/linkedin");
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/linkedin/disconnect", {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setAccount(null);
        setShowConfirmDisconnect(false);
        router.push("/settings");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStyle = async () => {
    setSavingStyle(true);
    try {
      const updatedStyleJson = {
        ...styleProfile?.style_json,
        tone_descriptor: editedTone,
        avg_post_length_words: Number(editedLength),
        sentence_length_pattern: editedSentencePattern,
        cta_style: editedCta,
        frequently_used_phrases: editedPhrases.split(",").map(s => s.trim()).filter(Boolean),
        avoided_corporate_words: editedAvoided.split(",").map(s => s.trim()).filter(Boolean),
      };

      const res = await fetch("/api/style/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style_json: updatedStyleJson,
          sample_post: editedSample,
          user_confirmed: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStyleProfile(data.profile);
          setIsEditingStyle(false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingStyle(false);
    }
  };

  if (loading) {
    return (
      <IosShell>
        <div className="flex items-center justify-center min-h-[50vh] text-sm text-zinc-400">
          Loading connection status...
        </div>
      </IosShell>
    );
  }

  return (
    <IosShell>
      <div className="pt-6 px-4 max-w-4xl mx-auto w-full">
        {/* iOS Nav Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push("/settings")} className="ios-back-btn">
            <ArrowLeft className="w-5 h-5" /> Profile
          </button>
          <span className="font-semibold text-zinc-900 dark:text-white text-base">LinkedIn</span>
          <div className="w-12" />
        </div>

        {account ? (
          /* CONNECTED VIEW */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Left Column on Desktop: Account details and Actions */}
              <div className="md:col-span-1 space-y-6">
                <div className="space-y-2">
                  <div className="ios-section-label">Connected Account</div>
                  <div className="ios-card p-5 flex items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 shrink-0 border border-blue-500/20">
                      <Link2 className="w-8 h-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-zinc-900 dark:text-white leading-tight">
                        {account.profile_name || "Linked Account"}
                      </h4>
                      <p className="text-xs text-green-500 font-bold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Scraped {account.posts_scraped || 0} posts
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Status: {account.status.toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                {/* Warning yellow badge if low data */}
                {account.status === "low_data" && (
                  <div className="ios-card bg-amber-500/10 border border-amber-500/20 p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold leading-relaxed">
                      Not enough posts to learn your style. Expert styles will give better results. We&apos;ll improve as you post more.
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 pt-2 px-4 md:px-0">
                  <button
                    onClick={() => router.push("/settings/linkedin/scraping")}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl active:scale-98 border-none text-[17px] font-semibold flex items-center justify-center cursor-pointer transition-colors duration-200"
                  >
                    Re-analyze style
                  </button>

                  <button
                    onClick={() => setShowConfirmDisconnect(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl active:scale-98 border-none text-[17px] font-semibold flex items-center justify-center cursor-pointer transition-colors duration-200"
                  >
                    Disconnect account
                  </button>
                </div>
              </div>

              {/* Right Column on Desktop: Writing Style Profile */}
              <div className="md:col-span-2 space-y-6">
                {styleProfile && (
                  <div className="space-y-3">
                    <div className="ios-section-label flex justify-between items-center px-1">
                      <span>WRITING STYLE PROFILE</span>
                      {!isEditingStyle && (
                        <button
                          onClick={() => setIsEditingStyle(true)}
                          className="text-xs text-blue-500 font-bold hover:underline"
                        >
                          Edit Profile
                        </button>
                      )}
                    </div>

                    {isEditingStyle ? (
                      <div className="ios-card p-4 space-y-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">Tone Descriptor</label>
                          <input
                            type="text"
                            value={editedTone}
                            onChange={(e) => setEditedTone(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Avg Word Count</label>
                            <input
                              type="number"
                              value={editedLength}
                              onChange={(e) => setEditedLength(Number(e.target.value))}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Sentence Style</label>
                            <input
                              type="text"
                              value={editedSentencePattern}
                              onChange={(e) => setEditedSentencePattern(e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">CTA Style</label>
                          <input
                            type="text"
                            value={editedCta}
                            onChange={(e) => setEditedCta(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">Frequently Used Phrases (comma separated)</label>
                          <input
                            type="text"
                            value={editedPhrases}
                            onChange={(e) => setEditedPhrases(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">Avoided Corporate Words (comma separated)</label>
                          <input
                            type="text"
                            value={editedAvoided}
                            onChange={(e) => setEditedAvoided(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-805 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase">Sample Generated Post Preview</label>
                          <textarea
                            value={editedSample}
                            onChange={(e) => setEditedSample(e.target.value)}
                            rows={12}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-semibold focus:outline-none focus:border-blue-500 font-sans whitespace-pre-wrap"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveStyle}
                            disabled={savingStyle}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs border-none cursor-pointer transition-colors duration-150"
                          >
                            {savingStyle ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            onClick={() => {
                              const sj = styleProfile.style_json || {};
                              setEditedTone(sj.tone_descriptor || "");
                              setEditedLength(sj.avg_post_length_words || 120);
                              setEditedSentencePattern(sj.sentence_length_pattern || "");
                              setEditedCta(sj.cta_style || "");
                              setEditedPhrases((sj.frequently_used_phrases || []).join(", "));
                              setEditedAvoided((sj.avoided_corporate_words || []).join(", "));
                              setEditedSample(styleProfile.sample_post || "");
                              setIsEditingStyle(false);
                            }}
                            className="flex-1 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold py-2 rounded-xl text-xs bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors duration-150"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="ios-card bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Writing Tone</p>
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize mt-0.5">{editedTone || "Not specified"}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Average Length</p>
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{editedLength} words</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Sentence Structure</p>
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{editedSentencePattern || "Not specified"}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">CTA Style</p>
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize mt-0.5">{editedCta || "Not specified"}</p>
                            </div>
                          </div>
                        </div>

                        {(editedPhrases || editedAvoided) && (
                          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 space-y-3">
                            {editedPhrases && (
                              <div>
                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Frequent Phrases</p>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {editedPhrases.split(",").map((p, i) => (
                                    <span key={i} className="text-[10px] font-semibold bg-blue-500/10 text-blue-500 px-2.5 py-0.5 rounded-full">
                                      {p.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {editedAvoided && (
                              <div>
                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Avoided Corporate Buzzwords</p>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {editedAvoided.split(",").map((p, i) => (
                                    <span key={i} className="text-[10px] font-semibold bg-red-500/10 text-red-500 px-2.5 py-0.5 rounded-full">
                                      {p.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {editedSample && (
                          <div className="p-4">
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Style Sample Post</p>
                            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/80">
                              <p className="text-sm italic text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap">
                                {editedSample}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* iOS confirmation action sheet */}
            {showConfirmDisconnect && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center px-4 pb-8 backdrop-blur-sm">
                <div className="w-full max-w-sm space-y-3">
                  <div className="bg-white/90 dark:bg-zinc-900/95 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 backdrop-blur-md">
                    <div className="p-4 text-center border-b border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">LinkedIn Access</p>
                      <p className="text-sm text-zinc-500 font-semibold mt-1.5 leading-relaxed">
                        Disconnect LinkedIn? Your style profile and posts will be deleted.
                      </p>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="w-full py-4 text-center font-bold text-red-500 hover:bg-red-500/10 active:opacity-60 transition-colors border-none cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                  <button
                    onClick={() => setShowConfirmDisconnect(false)}
                    className="w-full py-4 bg-white dark:bg-zinc-900 rounded-2xl text-center font-bold text-blue-600 hover:opacity-90 active:scale-98 transition-transform border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* DISCONNECTED VIEW */
          <div className="space-y-6 pb-12">
            <div className="text-center py-6">
              <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white">Link Your LinkedIn</h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-1 leading-relaxed">
                Connect your account to teach VoicePost your unique personal writing style.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Column: How it works */}
              <div className="space-y-4">
                <div className="ios-section-label">How it works</div>
                <div className="ios-card bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">STEP 1 — Authorize with LinkedIn OAuth</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-300 leading-relaxed mt-1">
                      You&apos;re redirected to linkedin.com. VoicePost never sees your LinkedIn password.
                    </p>
                  </div>
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">STEP 2 — We fetch your own posts only</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-300 leading-relaxed mt-1">
                      Using LinkedIn UGC Posts API scoped to your profile ID. Only posts you authored are fetched. API endpoint:
                      <code className="block bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl text-[10px] mt-2 break-all text-zinc-700 dark:text-zinc-300 font-mono border border-zinc-200/50 dark:border-zinc-850">
                        GET /v2/ugcPosts?q=authors&authors=List(urn:li:person:YOUR_ID)
                      </code>
                    </p>
                  </div>
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">STEP 3 — AI learns your writing style</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-300 leading-relaxed mt-1">
                      We analyze tone, structure, vocabulary, and patterns from your posts. This profile is private to you — never shared.
                    </p>
                  </div>
                  <div className="p-4">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">STEP 4 — Auto-post with your approval</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-300 leading-relaxed mt-1">
                      Every post requires your explicit approval before publishing. One tap to disconnect anytime.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Permissions & Connect Button */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="ios-section-label">Requested API Permissions</div>
                  <div className="ios-card bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-2 text-xs font-semibold select-none">
                    <div className="flex justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">✅ r_liteprofile</span>
                      <span className="text-zinc-400">Read name, photo, headline</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">✅ r_emailaddress</span>
                      <span className="text-zinc-400">Read email for auth sync</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">✅ w_member_social</span>
                      <span className="text-zinc-400">Publish posts on your behalf</span>
                    </div>
                    <div className="flex justify-between text-red-500/80">
                      <span>❌ Connections</span>
                      <span className="font-normal text-[10px]">Never requested</span>
                    </div>
                    <div className="flex justify-between text-red-500/80">
                      <span>❌ Messages & InMail</span>
                      <span className="font-normal text-[10px]">Never requested</span>
                    </div>
                    <div className="flex justify-between text-red-500/80">
                      <span>❌ News feed / other users</span>
                      <span className="font-normal text-[10px]">Never requested</span>
                    </div>
                  </div>
                </div>

                <div className="ios-card bg-blue-500/10 border border-blue-500/20 p-4 flex gap-3">
                  <Info className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold leading-relaxed">
                    VoicePost accesses ONLY your own posts via LinkedIn&apos;s official API. We never read connections, messages, or other people&apos;s data. Revoke access anytime at: LinkedIn → Settings → Data Privacy → Permitted Services → VoicePost → Remove.
                  </div>
                </div>

                {/* Connect CTA Button */}
                <div className="pt-2 px-4 md:px-0">
                  <button
                    onClick={handleConnect}
                    className="w-full bg-[#0077b5] hover:bg-[#006297] text-white font-bold py-4 rounded-2xl active:scale-98 shadow-md border-none flex items-center justify-center gap-2 text-[17px] font-semibold cursor-pointer transition-colors duration-200"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                    Connect LinkedIn
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </IosShell>
  );
}
