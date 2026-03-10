// src/components/PoliciesView.jsx
import { useState, useEffect, useCallback } from "react";
import {
  FileText, ExternalLink, Plus, Pencil, Trash2, X, Save, Link,
  BookOpen, Clock, Shield, Stethoscope, GraduationCap, Settings, ChevronDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { dbGet, dbInsert, dbUpdate, dbDelete } from "../lib/supabaseHelpers";
import { policies as staticPolicies } from "../data/policies";

const CATEGORIES = [
  { value: "general",        label: "General",           Icon: FileText,      color: "text-slate-500",  bg: "bg-slate-50 dark:bg-slate-900/40" },
  { value: "leave",          label: "Leave & Time Off",  Icon: Clock,         color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/20" },
  { value: "duty_hours",     label: "Duty Hours",        Icon: Shield,        color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/20" },
  { value: "clinical",       label: "Clinical",          Icon: Stethoscope,   color: "text-green-500",  bg: "bg-green-50 dark:bg-green-900/20" },
  { value: "administrative", label: "Administrative",    Icon: Settings,      color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
  { value: "education",      label: "Education",         Icon: GraduationCap, color: "text-rose-500",   bg: "bg-rose-50 dark:bg-rose-900/20" },
];

function PolicyModal({ policy, onSave, onClose }) {
  const [form, setForm] = useState({
    title:        policy?.title        ?? "",
    description:  policy?.description  ?? "",
    document_url: policy?.document_url ?? "",
    category:     policy?.category     ?? "general",
    sort_order:   policy?.sort_order   ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, title: form.title.trim(), sort_order: Number(form.sort_order) });
    } catch (err) {
      setError(err.message ?? "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {policy ? "Edit Document" : "Add Document"}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Vacation & Leave Policy"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Brief description (optional)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Document Link</label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="url"
                value={form.document_url}
                onChange={(e) => setForm((f) => ({ ...f, document_url: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-8 pr-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://docs.example.com/policy.pdf"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              min={0}
              className="w-24 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.title.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PoliciesView({ programId: programIdProp }) {
  const { programId: authProgramId, canManage, user, isSupabaseConfigured } = useAuth();
  const programId = programIdProp ?? authProgramId;

  const [dbPolicies, setDbPolicies]       = useState(null);
  const [loading, setLoading]             = useState(false);
  const [modalOpen, setModalOpen]         = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [collapsed, setCollapsed]         = useState(new Set());

  const toggleCollapse = (value) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });

  const fetchPolicies = useCallback(async () => {
    if (!isSupabaseConfigured || !programId) return;
    setLoading(true);
    const { data, error } = await dbGet("policies", { program_id: programId }, {
      order: { column: "sort_order", ascending: true },
    });
    // Only swap out the static fallback on a successful fetch (no error = table exists)
    if (!error) setDbPolicies(data ?? []);
    setLoading(false);
  }, [isSupabaseConfigured, programId]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  // Fall back to static list if DB not loaded yet
  const allPolicies = dbPolicies ?? staticPolicies.map((p) => ({
    id: p.id,
    title: p.title,
    description: null,
    document_url: null,
    category: "general",
    sort_order: p.id,
    _static: true,
  }));

  // Group by category, preserving CATEGORIES order
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: allPolicies.filter((p) => (p.category ?? "general") === cat.value),
  })).filter((g) => g.items.length > 0);

  const handleSave = async (formData) => {
    if (editingPolicy) {
      const { data, error } = await dbUpdate("policies", editingPolicy.id, formData);
      if (error) throw new Error(error.message);
      setDbPolicies((prev) => prev.map((p) => (p.id === editingPolicy.id ? data : p)));
    } else {
      const { data, error } = await dbInsert("policies", {
        ...formData,
        program_id: programId,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      setDbPolicies((prev) => [...(prev ?? []), data]);
    }
    setModalOpen(false);
    setEditingPolicy(null);
  };

  const handleDelete = async (id) => {
    const { error } = await dbDelete("policies", id);
    if (!error) setDbPolicies((prev) => prev.filter((p) => p.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Policies & Documents</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Program reference library</p>
          </div>
        </div>
        {canManage && isSupabaseConfigured && programId && (
          <button
            onClick={() => { setEditingPolicy(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Document
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <div className="h-5 w-40 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 text-center text-gray-400 dark:text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No policies yet.</p>
          {canManage && <p className="text-xs mt-1">Click "Add Policy" to get started.</p>}
        </div>
      ) : (
        grouped.map(({ value, label, Icon, color, bg, items }) => (
          <div key={value} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCollapse(value)}
              className={`w-full flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 ${bg} ${collapsed.has(value) ? "border-b-0" : ""}`}
            >
              <Icon className={`w-4 h-4 ${color} shrink-0`} />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 mr-2">{items.length} {items.length === 1 ? "document" : "documents"}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${collapsed.has(value) ? "-rotate-90" : ""}`} />
            </button>

            {/* Policy rows */}
            {!collapsed.has(value) && (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/60">
              {items.map((policy) => (
                <div key={policy.id} className="group flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                  <FileText className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {policy.document_url ? (
                        <a
                          href={policy.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {policy.title}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{policy.title}</span>
                      )}
                      {!policy.document_url && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">Coming soon</span>
                      )}
                    </div>
                    {policy.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{policy.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {policy.document_url && (
                      <a
                        href={policy.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {canManage && !policy._static && (
                      <>
                        <button
                          onClick={() => { setEditingPolicy(policy); setModalOpen(true); }}
                          className="p-1 rounded text-gray-300 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirm === policy.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-500">Delete?</span>
                            <button onClick={() => handleDelete(policy.id)} className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600">Yes</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200">No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(policy.id)}
                            className="p-1 rounded text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        ))
      )}

      {modalOpen && (
        <PolicyModal
          policy={editingPolicy}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingPolicy(null); }}
        />
      )}
    </div>
  );
}
