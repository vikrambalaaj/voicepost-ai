"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SparklesCore } from "@/components/ui/sparkles-core";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check search params for errors
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err === "oauth_failed") {
        setErrorMsg("LinkedIn authentication failed. Please try again.");
      } else if (err === "db_error") {
        setErrorMsg("Database error: Failed to save your account details.");
      } else if (err === "csrf_failed") {
        setErrorMsg("Security validation failed. Please try logging in again.");
      } else if (err) {
        setErrorMsg(`Login error: ${err}`);
      }
    }

    // If already logged in, skip to dashboard
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) router.replace("/dashboard");
        else setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));
  }, []);

  const handleLinkedInLogin = () => {
    setLoading(true);
    window.location.href = "/api/auth/linkedin?purpose=login";
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Sparkles background */}
      <div className="absolute inset-0 z-0">
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1.0}
          particleDensity={50}
          particleColor="#3B82F6"
          speed={0.8}
          className="w-full h-full"
        />
      </div>

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-2xl shadow-blue-500/30">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">VoicePost</h1>
          <p className="text-zinc-400 text-sm mt-1">AI-powered LinkedIn content</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-2 text-center">Welcome back</h2>
          <p className="text-zinc-400 text-sm text-center mb-8 leading-relaxed">
            Sign in with LinkedIn to access your posts, writing styles, and publishing tools.
          </p>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-950/50 border border-red-500/30 rounded-2xl text-xs text-red-400 leading-relaxed font-semibold text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* LinkedIn Login Button */}
          <button
            onClick={handleLinkedInLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#0A66C2] hover:bg-[#004182] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-blue-900/40"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            )}
            {loading ? "Connecting to LinkedIn..." : "Continue with LinkedIn"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600 font-medium">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Demo Mode */}
          <button
            onClick={() => {
              setLoading(true);
              window.location.href = "/api/auth/linkedin?purpose=login&demo=true";
            }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold py-3.5 px-6 rounded-2xl transition-all duration-200 text-sm border border-zinc-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
            </svg>
            Try Demo (no LinkedIn needed)
          </button>
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-zinc-600 mt-6 leading-relaxed">
          By signing in you agree to our{" "}
          <span className="text-zinc-500 underline cursor-pointer">Terms</span> and{" "}
          <span className="text-zinc-500 underline cursor-pointer">Privacy Policy</span>.
          <br />We never post without your approval.
          <br /><span className="text-[10px] text-zinc-700 mt-2 block font-mono">VoicePost App v1.3.1</span>
        </p>
      </div>
    </div>
  );
}
