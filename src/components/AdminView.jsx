// src/components/AdminView.jsx
import { useState, useEffect, useCallback } from "react";
import { Shield, Users, UserPlus, CheckCircle, AlertCircle, RefreshCw, Calendar, MessageSquare } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const ROLES = ["resident", "fellow", "chief_fellow", "program_director", "admin"];
const ROLE_LABELS = {
  admin: "Admin",
  program_director: "Program Director",
  chief_fellow: "Chief Fellow",
  fellow: "Fellow",
  resident: "Resident",
};
const ROLE_COLORS = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  program_director: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  chief_fellow: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  fellow: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  resident: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const EMPTY_FORM = { email: "", username: "", full_name: "", role: "fellow", program: "", password: "" };
const CLINIC_DAY_LABELS = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday" };
const TYPE_COLORS = {
  bug: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  feature: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export default function AdminView({ darkMode, fellows = [], pgyLevels = {}, clinicDays = {}, setClinicDays }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [feedback, setFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ email: "" });
  const [updating, setUpdating] = useState(false);

  const card = `rounded-lg border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;
  const labelCls = `block text-xs font-medium mb-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`;
  const inputCls = `w-full px-3 py-2 rounded text-sm border outline-none transition-colors ${
    darkMode
      ? "bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-500"
      : "bg-gray-50 border-gray-300 text-gray-800 focus:border-blue-500"
  }`;

  const fetchUsers = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role, program, is_active, created_at")
      .eq("institution_id", profile.institution_id)
      .order("role")
      .order("full_name");
    if (!error) setUsers(data || []);
    setLoadingUsers(false);
  }, [profile?.institution_id]);

  const fetchFeedback = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoadingFeedback(true);
    const { data, error } = await supabase
      .from("feedback")
      .select("id, category, message, anonymous, user_id, status, created_at, profiles(full_name, email)")
      .eq("institution_id", profile.institution_id)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });
    if (!error) setFeedback(data || []);
    setLoadingFeedback(false);
  }, [profile?.institution_id]);

  const updateFeedbackStatus = async (feedbackId, newStatus) => {
    const { error } = await supabase
      .from("feedback")
      .update({ status: newStatus })
      .eq("id", feedbackId);
    if (!error) {
      setFeedback((prev) =>
        prev.map((item) =>
          item.id === feedbackId ? { ...item, status: newStatus } : item
        )
      );
    }
  };

  useEffect(() => {
    if (tab === "users" || tab === "edit") fetchUsers();
    if (tab === "feedback") fetchFeedback();
  }, [tab, fetchUsers, fetchFeedback]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    const { email, username, full_name, role, program, password } = form;

    // Create the Supabase Auth user.
    // When email confirmation is required (the default), this does NOT change
    // the current admin session — the new user receives a confirmation email.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setMessage({ type: "error", text: authError.message });
      setCreating(false);
      return;
    }

    const newUserId = authData.user?.id;
    if (!newUserId) {
      setMessage({
        type: "error",
        text: "User was created in Auth but no ID was returned. Add the profile manually via the Supabase dashboard.",
      });
      setCreating(false);
      return;
    }

    // Insert the profile record so the user has a role when they first log in.
    const { error: profileError } = await supabase.from("profiles").insert({
      id: newUserId,
      institution_id: profile.institution_id,
      email,
      username: username || null,
      full_name: full_name || null,
      role,
      program: program || null,
    });

    if (profileError) {
      setMessage({
        type: "error",
        text: `Auth account created, but profile insert failed: ${profileError.message}. You may need the admin INSERT policy (see migration SQL).`,
      });
    } else {
      setMessage({
        type: "success",
        text: `Created! ${email} will receive a confirmation email to activate their account.`,
      });
      setForm(EMPTY_FORM);
      // Refresh user list if we're going back to it
      fetchUsers();
    }
    setCreating(false);
  };

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEditingUser = (user) => {
    setEditingUserId(user.id);
    setEditForm({ email: user.email });
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setEditForm({ email: "" });
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    if (!editingUserId || !editForm.email) return;

    setUpdating(true);
    setMessage(null);

    // Update profile email
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ email: editForm.email })
      .eq("id", editingUserId);

    if (profileError) {
      setMessage({ type: "error", text: `Failed to update email: ${profileError.message}` });
      setUpdating(false);
      return;
    }

    setMessage({
      type: "success",
      text: "Email updated! Note: The auth email must be updated separately via Supabase dashboard if different.",
    });
    // Refresh users list
    fetchUsers();
    setTimeout(() => cancelEditing(), 1500);
    setUpdating(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Shield className="w-5 h-5" /> Admin Panel
      </h2>

      {/* Tab switcher */}
      <div className={`flex gap-1 p-1 rounded-lg ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>
        {[
          { key: "users", label: "Users", Icon: Users },
          { key: "create", label: "Create User", Icon: UserPlus },
          { key: "edit", label: "Edit User", Icon: Users },
          { key: "clinic", label: "Clinic Days", Icon: Calendar },
          { key: "feedback", label: "Feedback", Icon: MessageSquare },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setMessage(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === key
                ? "bg-blue-600 text-white"
                : darkMode
                ? "text-gray-400 hover:text-gray-200"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Users tab ─────────────────────────────────────────────────── */}
      {tab === "users" && (
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {users.length} user{users.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={fetchUsers}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : users.length === 0 ? (
            <p className={`text-sm text-center py-6 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              No users found.{" "}
              <span className={darkMode ? "text-gray-500" : "text-gray-400"}>
                (Ensure the admin SELECT policy exists — see migration SQL Step 10.)
              </span>
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr
                    className={`text-xs border-b ${
                      darkMode ? "text-gray-400 border-gray-700" : "text-gray-500 border-gray-200"
                    }`}
                  >
                    <th className="text-left py-2 pr-4 font-medium">Name</th>
                    <th className="text-left py-2 pr-4 font-medium">Username</th>
                    <th className="text-left py-2 pr-4 font-medium">Email</th>
                    <th className="text-left py-2 pr-4 font-medium">Role</th>
                    <th className="text-left py-2 font-medium">Program</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b ${darkMode ? "border-gray-700/50" : "border-gray-100"}`}
                    >
                      <td className="py-2 pr-4">{u.full_name || <span className={darkMode ? "text-gray-600" : "text-gray-400"}>—</span>}</td>
                      <td className={`py-2 pr-4 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{u.username || <span className={darkMode ? "text-gray-600" : "text-gray-400"}>—</span>}</td>
                      <td className={`py-2 pr-4 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{u.email}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role] || ""}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className={`py-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {u.program || <span className={darkMode ? "text-gray-600" : "text-gray-400"}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Edit User tab ────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div className={card}>
          {editingUserId ? (
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div>
                <label className={labelCls}>New Email *</label>
                <input
                  type="email"
                  className={inputCls}
                  value={editForm.email}
                  onChange={(e) => setEditForm({ email: e.target.value })}
                  placeholder="user@hospital.edu"
                  required
                />
              </div>

              {message && (
                <div
                  className={`flex items-start gap-1.5 text-xs p-2.5 rounded ${
                    message.type === "error"
                      ? darkMode ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"
                      : message.type === "warning"
                      ? darkMode ? "bg-yellow-900/20 text-yellow-400" : "bg-yellow-50 text-yellow-600"
                      : darkMode ? "bg-green-900/20 text-green-400" : "bg-green-50 text-green-600"
                  }`}
                >
                  {message.type === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  {message.text}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
                >
                  {updating ? "Updating..." : "Update Email"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className={`px-4 py-2 text-sm font-semibold rounded transition-colors ${
                    darkMode
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                Select a user to edit their email address.
              </p>
              {users.length === 0 ? (
                <p className={`text-sm text-center py-6 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  No users found. Refresh the Users tab first.
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-1.5">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => startEditingUser(user)}
                      className={`w-full text-left px-3 py-2.5 rounded border transition-colors ${
                        darkMode
                          ? "border-gray-700 bg-gray-700/40 hover:bg-gray-700/60 text-gray-100"
                          : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{user.full_name || user.username || "Unnamed"}</p>
                          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{user.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[user.role] || ""}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Clinic Days tab ───────────────────────────────────────────── */}
      {tab === "clinic" && (
        <div className={card}>
          <p className={`text-xs mb-4 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
            Set each fellow's assigned clinic day. Changes are saved locally and pushed to Supabase
            when you click <strong>Validate</strong> in the Edit Schedule view.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fellows.map(fellow => (
              <div key={fellow} className={`flex items-center justify-between gap-3 px-3 py-2 rounded border ${
                darkMode ? "border-gray-700 bg-gray-700/40" : "border-gray-200 bg-gray-50"
              }`}>
                <div>
                  <span className="text-sm font-medium">{fellow}</span>
                  <span className={`ml-2 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                    PGY-{pgyLevels[fellow] ?? "?"}
                  </span>
                </div>
                <select
                  className={`text-sm rounded border px-2 py-1 ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-gray-100"
                      : "bg-white border-gray-300 text-gray-800"
                  }`}
                  value={clinicDays[fellow] ?? ""}
                  onChange={e => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setClinicDays(prev => {
                      const next = { ...prev };
                      if (val !== undefined) next[fellow] = val;
                      else delete next[fellow];
                      return next;
                    });
                  }}
                >
                  <option value="">— none —</option>
                  {[1, 2, 3, 4].map(d => (
                    <option key={d} value={d}>{CLINIC_DAY_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create User tab ───────────────────────────────────────────── */}
      {tab === "create" && (
        <div className={card}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Email *</label>
                <input
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={setField("email")}
                  placeholder="user@hospital.edu"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Username *</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.username}
                  onChange={setField("username")}
                  placeholder="e.g. jsmith"
                  autoCapitalize="none"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.full_name}
                  onChange={setField("full_name")}
                  placeholder="Dr. Jane Smith"
                />
              </div>

              <div>
                <label className={labelCls}>Role *</label>
                <select
                  className={inputCls}
                  value={form.role}
                  onChange={setField("role")}
                  required
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Program</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.program}
                  onChange={setField("program")}
                  placeholder="e.g. Cardiology"
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Temporary Password *</label>
                <input
                  type="password"
                  className={inputCls}
                  value={form.password}
                  onChange={setField("password")}
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                />
                <p className={`mt-1 text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                  The user will receive a confirmation email and should change their password on first login.
                  This requires email confirmation to be enabled in your Supabase project (the default).
                </p>
              </div>
            </div>

            {message && (
              <div
                className={`flex items-start gap-1.5 text-xs p-2.5 rounded ${
                  message.type === "error"
                    ? darkMode ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"
                    : darkMode ? "bg-green-900/20 text-green-400" : "bg-green-50 text-green-600"
                }`}
              >
                {message.type === "error" ? (
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                )}
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {creating ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>
      )}

      {/* ── Feedback tab ───────────────────────────────────────────── */}
      {tab === "feedback" && (
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {feedback.length} feedback item{feedback.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={fetchFeedback}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {loadingFeedback ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : feedback.length === 0 ? (
            <p className={`text-sm text-center py-6 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              No feedback received yet.
            </p>
          ) : (
            <div className="space-y-2">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded border ${
                    darkMode ? "border-gray-700 bg-gray-700/30" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[item.category] || ""}`}>
                        {item.category === "bug" ? "Bug" : item.category === "feature" ? "Feature" : "Other"}
                      </span>
                      <span className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {item.anonymous ? "Anonymous" : (item.profiles?.full_name || item.profiles?.email || "Unknown")}
                      </span>
                      <span className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <select
                      value={item.status}
                      onChange={(e) => updateFeedbackStatus(item.id, e.target.value)}
                      className={`text-xs rounded border px-2 py-1 ${
                        darkMode
                          ? "bg-gray-700 border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-800"
                      }`}
                    >
                      <option value="open">Open</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
