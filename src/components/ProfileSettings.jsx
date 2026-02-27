import { useEffect, useState } from "react";
import { User, Save, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const roleLabels = {
  admin: "Admin",
  program_director: "Program Director",
  chief_fellow: "Chief Fellow",
  fellow: "Fellow",
  resident: "Resident",
};

function normalizeUsername(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, ""); // keep it simple and predictable
}

export default function ProfileSettings({ darkMode, toggleDarkMode }) {
  const auth = useAuth() || {};
  const { user, profile, updateProfile, isAdmin } = auth;

  // isAdmin is always a boolean from AuthContext (false when profile is loading)
  const canEditIdentity = isAdmin;

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Keep local inputs in sync with profile as it loads/refreshes
  useEffect(() => {
    setFullName(profile?.full_name || "");
    setUsername(profile?.username || "");
  }, [profile?.full_name, profile?.username]);

  const handleSave = async () => {
    setMessage(null);

    if (!canEditIdentity) {
      setMessage({ type: "error", text: "You do not have permission to edit these fields." });
      return;
    }

    if (typeof updateProfile !== "function") {
      setMessage({ type: "error", text: "updateProfile is not available. Check AuthContext exports." });
      return;
    }

    const payload = {
      full_name: fullName?.trim() || null,
      username: normalizeUsername(username) || null,
    };

    setSaving(true);
    try {
      const result = await updateProfile(payload);

      // Support either shape:
      // - returns { error }
      // - throws on error
      const error = result?.error;
      setMessage(
        error
          ? { type: "error", text: error.message || "Failed to update profile." }
          : { type: "success", text: "Profile updated" }
      );
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  const card = `rounded-lg border p-4 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;
  const label = `block text-xs font-medium mb-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`;
  const input = `w-full px-3 py-2 rounded text-sm border ${
    darkMode
      ? "bg-gray-700 border-gray-600 text-gray-100 focus:border-blue-500"
      : "bg-gray-50 border-gray-300 text-gray-800 focus:border-blue-500"
  } outline-none`;
  const readOnly = `w-full px-3 py-2 rounded text-sm ${
    darkMode ? "bg-gray-700/50 text-gray-400" : "bg-gray-100 text-gray-500"
  }`;

  const originalFullName = profile?.full_name || "";
  const originalUsername = profile?.username || "";
  const isDirty =
    (fullName || "") !== originalFullName || (username || "") !== originalUsername;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <User className="w-5 h-5" /> Profile & Settings
      </h2>

      {/* Profile Card */}
      <div className={card}>
        <div className="space-y-3">
          <div>
            <label className={label}>Username</label>
            {canEditIdentity ? (
              <input
                className={input}
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                placeholder="Your login username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            ) : (
              <div className={readOnly}>{username || "—"}</div>
            )}
          </div>

          <div>
            <label className={label}>Full Name</label>
            {canEditIdentity ? (
              <input
                className={input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            ) : (
              <div className={readOnly}>{fullName || "—"}</div>
            )}
          </div>

          <div>
            <label className={label}>Email</label>
            <div className={readOnly}>{user?.email || "—"}</div>
          </div>

          <div>
            <label className={label}>Role</label>
            <div className={readOnly}>{roleLabels[profile?.role] || profile?.role || "—"}</div>
          </div>

          {profile?.institution?.name && (
            <div>
              <label className={label}>Institution</label>
              <div className={readOnly}>{profile.institution.name}</div>
            </div>
          )}

          {message && (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                message.type === "error" ? "text-red-400" : "text-green-400"
              }`}
            >
              {message.type === "error" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              {message.text}
            </div>
          )}

          {canEditIdentity && (
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Settings Card */}
      <div className={card}>
        <h3 className={`text-sm font-semibold mb-3 ${darkMode ? "text-gray-200" : "text-gray-700"}`}>Settings</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm">Dark Mode</span>
          <button
            type="button"
            onClick={typeof toggleDarkMode === "function" ? toggleDarkMode : undefined}
            disabled={typeof toggleDarkMode !== "function"}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              darkMode ? "bg-blue-600" : "bg-gray-300"
            } ${typeof toggleDarkMode !== "function" ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                darkMode ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}