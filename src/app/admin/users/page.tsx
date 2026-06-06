"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, ShieldAlert } from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        if (data.success) {
          setUsers(data.users);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
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
        <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-sm font-semibold text-blue-400 hover:text-blue-300">
          <ArrowLeft className="w-4 h-4" /> Admin Console
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">Registered Users</h1>
        <div className="w-12" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-500">Loading user logs...</div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-bold text-zinc-300">Operational Log Profiles ({users.length})</span>
          </div>

          <div className="divide-y divide-zinc-800">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-zinc-200">{u.email}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">ID: {u.id}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold px-2 py-0.5 rounded-full uppercase text-[10px]">
                    {u.plan} plan
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Joined: {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
