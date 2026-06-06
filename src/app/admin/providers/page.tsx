"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Save, Plus, Trash2, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // New provider form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState({
    id: "",
    name: "",
    priority: 1,
    enabled: true,
    model_free: "",
    model_starter: "",
    model_pro: "",
    model_agency: "",
    daily_limit_override: "",
    rpm_limit_override: "",
  });

  async function loadProviders() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/providers");
      const data = await res.json();
      if (data.success) {
        setProviders(data.providers || []);
      }
    } catch (e) {
      console.error("Failed to load providers", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  const handleUpdate = async (id: string, updatedFields: any) => {
    try {
      setSavingId(id);
      setMessage(null);
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      const data = await res.json();
      if (data.success) {
        setProviders(providers.map((p) => (p.id === id ? data.provider : p)));
        setMessage(`Provider ${id} updated successfully!`);
        setTimeout(() => setMessage(null), 3000);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete ${id}?`)) return;
    try {
      setMessage(null);
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setProviders(providers.filter((p) => p.id !== id));
        setMessage(`Deleted provider ${id}`);
        setTimeout(() => setMessage(null), 3000);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProvider,
          priority: Number(newProvider.priority),
          daily_limit_override: newProvider.daily_limit_override ? Number(newProvider.daily_limit_override) : null,
          rpm_limit_override: newProvider.rpm_limit_override ? Number(newProvider.rpm_limit_override) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProviders([...providers, data.provider].sort((a, b) => a.priority - b.priority));
        setShowAddForm(false);
        setNewProvider({
          id: "",
          name: "",
          priority: 1,
          enabled: true,
          model_free: "",
          model_starter: "",
          model_pro: "",
          model_agency: "",
          daily_limit_override: "",
          rpm_limit_override: "",
        });
        setMessage("New provider added!");
        setTimeout(() => setMessage(null), 3000);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 select-text">
      {/* Admin Privacy Banner */}
      <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex gap-3">
        <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
        <div className="text-xs text-red-400 font-semibold leading-relaxed">
          <p className="font-extrabold uppercase tracking-wide mb-1">Admin view — Provider Config Panel</p>
          Update LLM priority ordering, dynamic models mapping, or API limits. Custom settings will override environment defaults immediately.
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/admin")} className="flex items-center gap-1 text-sm font-semibold text-blue-400 hover:text-blue-300">
          <ArrowLeft className="w-4 h-4" /> Admin Console
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">AI Providers Mappings</h1>
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-500 flex gap-1 items-center rounded-lg text-xs font-bold py-1.5 px-3">
          <Plus className="w-4 h-4" /> Add Custom
        </Button>
      </div>

      {message && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" /> {message}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-8 p-5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4 text-xs">
          <h3 className="font-bold text-sm text-zinc-200">Register New Provider Config</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Provider ID (e.g. together, local)</label>
              <input
                required
                type="text"
                placeholder="together"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                value={newProvider.id}
                onChange={(e) => setNewProvider({ ...newProvider, id: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Provider Display Name</label>
              <input
                required
                type="text"
                placeholder="Together AI"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Priority (1 = highest)</label>
              <input
                required
                type="number"
                min={1}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                value={newProvider.priority}
                onChange={(e) => setNewProvider({ ...newProvider, priority: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Status</label>
              <select
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                value={String(newProvider.enabled)}
                onChange={(e) => setNewProvider({ ...newProvider, enabled: e.target.value === "true" })}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          </div>

          <div className="border-t border-zinc-800/60 pt-3">
            <h4 className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Model Mappings</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold mb-1">Free Tier Model</label>
                <input
                  type="text"
                  placeholder="meta-llama/Llama-3-8b"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                  value={newProvider.model_free}
                  onChange={(e) => setNewProvider({ ...newProvider, model_free: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold mb-1">Starter Tier Model</label>
                <input
                  type="text"
                  placeholder="meta-llama/Llama-3-8b"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                  value={newProvider.model_starter}
                  onChange={(e) => setNewProvider({ ...newProvider, model_starter: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold mb-1">Pro Tier Model</label>
                <input
                  type="text"
                  placeholder="meta-llama/Llama-3-70b"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                  value={newProvider.model_pro}
                  onChange={(e) => setNewProvider({ ...newProvider, model_pro: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold mb-1">Agency Tier Model</label>
                <input
                  type="text"
                  placeholder="meta-llama/Llama-3-70b"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:border-blue-500 outline-none"
                  value={newProvider.model_agency}
                  onChange={(e) => setNewProvider({ ...newProvider, model_agency: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" type="button" variant="ghost" onClick={() => setShowAddForm(false)} className="rounded-lg text-zinc-400">Cancel</Button>
            <Button size="sm" type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">Save Provider</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-zinc-500">Loading configurations...</div>
      ) : providers.length === 0 ? (
        <div className="text-center py-12 text-sm text-zinc-500">No providers registered yet. Click &quot;Add Custom&quot; to seed or register.</div>
      ) : (
        <div className="space-y-6">
          {providers.map((p) => (
            <div key={p.id} className="p-5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4 text-xs relative">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    {p.name}
                    <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase">
                      ID: {p.id}
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Enabled</span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-blue-500 focus:ring-0 cursor-pointer bg-zinc-950 border-zinc-800"
                    checked={p.enabled}
                    onChange={(e) => handleUpdate(p.id, { ...p, enabled: e.target.checked })}
                  />
                  <button onClick={() => handleDelete(p.id)} className="text-zinc-500 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold mb-1">Priority</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 focus:border-blue-500 outline-none font-semibold text-white"
                    value={p.priority}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setProviders(providers.map((pr) => (pr.id === p.id ? { ...pr, priority: val } : pr)));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold mb-1">Daily Limit Override</label>
                  <input
                    type="number"
                    placeholder="None"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 focus:border-blue-500 outline-none text-white font-semibold"
                    value={p.daily_limit_override ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setProviders(providers.map((pr) => (pr.id === p.id ? { ...pr, daily_limit_override: val } : pr)));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold mb-1">RPM Limit Override</label>
                  <input
                    type="number"
                    placeholder="None"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 focus:border-blue-500 outline-none text-white font-semibold"
                    value={p.rpm_limit_override ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setProviders(providers.map((pr) => (pr.id === p.id ? { ...pr, rpm_limit_override: val } : pr)));
                    }}
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800/60 pt-3">
                <h4 className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider mb-2">Plan-Specific Model Overrides</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold mb-1">Free Tier Model</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 focus:border-blue-500 outline-none font-semibold text-zinc-300"
                      value={p.model_free ?? ""}
                      onChange={(e) => {
                        setProviders(providers.map((pr) => (pr.id === p.id ? { ...pr, model_free: e.target.value } : pr)));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold mb-1">Starter Tier Model</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 focus:border-blue-500 outline-none font-semibold text-zinc-300"
                      value={p.model_starter ?? ""}
                      onChange={(e) => {
                        setProviders(providers.map((pr) => (pr.id === p.id ? { ...pr, model_starter: e.target.value } : pr)));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold mb-1">Pro Tier Model</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 focus:border-blue-500 outline-none font-semibold text-zinc-300"
                      value={p.model_pro ?? ""}
                      onChange={(e) => {
                        setProviders(providers.map((pr) => (pr.id === p.id ? { ...pr, model_pro: e.target.value } : pr)));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-bold mb-1">Agency Tier Model</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 focus:border-blue-500 outline-none font-semibold text-zinc-300"
                      value={p.model_agency ?? ""}
                      onChange={(e) => {
                        setProviders(providers.map((pr) => (pr.id === p.id ? { ...pr, model_agency: e.target.value } : pr)));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/40">
                <Button
                  size="sm"
                  onClick={() => handleUpdate(p.id, p)}
                  disabled={savingId === p.id}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg flex items-center gap-1"
                >
                  {savingId === p.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
