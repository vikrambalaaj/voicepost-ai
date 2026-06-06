"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Users, Server, DollarSign, Activity, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminOverviewPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<any>(null);
  const [providers, setProviders] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("voicepost_is_admin", "true");
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/overview");
        const data = await res.json();
        if (data.success) {
          setMetrics(data.metrics);
          setProviders(data.provider_health);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 select-text">
      {/* Admin Privacy Banner (Strict compliance) */}
      <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex gap-3">
        <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
        <div className="text-xs text-red-400 font-semibold leading-relaxed">
          <p className="font-extrabold uppercase tracking-wide mb-1">Admin view — operational logs only</p>
          You can see: login times, latency, providers used, error rates, plan status. 
          You cannot see: post content, transcripts, voice recordings, style profiles, or user-created material. 
          This is enforced at the database level.
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/settings")} className="flex items-center gap-1 text-sm font-semibold text-blue-400 hover:text-blue-300">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">Admin Console</h1>
        <div className="w-12" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-500">Loading admin stats...</div>
      ) : (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Users</p>
                <p className="font-bold text-lg">{metrics.total_users}</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">MRR</p>
                <p className="font-bold text-lg">{metrics.mrr}</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center gap-3">
              <Activity className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">LLM Load</p>
                <p className="font-bold text-lg">{metrics.total_requests}</p>
              </div>
            </div>

            <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center gap-3">
              <Server className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Avg Latency</p>
                <p className="font-bold text-lg">{metrics.avg_latency}</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
            <Button
              onClick={() => router.push("/admin/users")}
              className="w-full justify-between bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-lg flex text-sm font-semibold"
            >
              <span>View User List (Masked)</span>
              <span>→</span>
            </Button>
            <Button
              onClick={() => router.push("/admin/providers")}
              className="w-full justify-between bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-lg flex text-sm font-semibold"
            >
              <span>Provider Priority Mappings</span>
              <span>→</span>
            </Button>
          </div>

          {/* Provider Health list */}
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">API Fallback Waterfall Health</h4>
            <div className="space-y-2 text-xs font-semibold">
              {Object.entries(providers || {}).map(([key, value]: any) => (
                <div key={key} className="flex justify-between py-1.5 border-b border-zinc-800 last:border-none">
                  <span className="capitalize text-zinc-300">{key}</span>
                  <div className="flex gap-3">
                    <span className="text-green-500 font-bold">{value.status}</span>
                    <span className="text-zinc-500">{value.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
