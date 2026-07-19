"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/lib/api";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  User,
  Lock,
  Bell,
  Key,
  Shield,
  LogOut,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react";

type Tab = "profile" | "security" | "api" | "notifications";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-cyan-600" : "bg-gray-600"}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { user, logout, updateUserProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile form
  const [profile, setProfile] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    timezone: user?.timezone || "UTC",
    preferredCurrency: user?.preferredCurrency || "USD",
  });

  // Password form
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [showPass, setShowPass] = useState({ current: false, newPass: false, confirm: false });
  const [passError, setPassError] = useState("");

  // Notifications
  const [notifs, setNotifs] = useState({
    emailAlerts: true,
    priceAlerts: false,
    tradeConfirmations: true,
    weeklyReport: false,
  });

  // Binance API (display only — stored in .env)
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateUserProfile(profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPassError("");
    if (passwords.newPass !== passwords.confirm) {
      setPassError("New passwords don't match.");
      return;
    }
    if (passwords.newPass.length < 8) {
      setPassError("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await api.auth.updateProfile({ password: passwords.newPass });
      setPasswords({ current: "", newPass: "", confirm: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setPassError(err?.response?.data?.detail || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile",       label: "Profile",        icon: User   },
    { id: "security",      label: "Security",       icon: Lock   },
    { id: "api",           label: "API Keys",       icon: Key    },
    { id: "notifications", label: "Notifications",  icon: Bell   },
  ];

  const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Asia/Karachi", "Asia/Dubai"];
  const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AED", "PKR"];

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-gray-400 mt-1">Manage your account, security, and preferences</p>
          </div>

          <div className="flex gap-6 flex-col lg:flex-row">
            {/* Sidebar Tabs */}
            <div className="lg:w-56 shrink-0">
              <nav className="space-y-1 bg-gray-800/50 border border-gray-700/50 rounded-2xl p-3">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeTab === id
                        ? "bg-cyan-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    <ChevronRight className={`w-3 h-3 ml-auto transition-opacity ${activeTab === id ? "opacity-100" : "opacity-0"}`} />
                  </button>
                ))}
                <div className="pt-2 border-t border-gray-700/50 mt-2">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-white hover:bg-red-600/20 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </nav>
            </div>

            {/* Content panels */}
            <div className="flex-1 space-y-6">
              {/* ──── Profile ──── */}
              {activeTab === "profile" && (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 space-y-6">
                  <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-400" /> Profile Information
                  </h2>

                  {/* Avatar initials */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                      {(user?.firstName?.[0] || user?.email?.[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{user?.email}</p>
                      <p className="text-gray-500 text-sm">{user?.isVerified ? "✓ Verified" : "Email not verified"}</p>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "First Name", key: "firstName" },
                      { label: "Last Name",  key: "lastName"  },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
                        <input
                          type="text"
                          value={profile[key as keyof typeof profile]}
                          onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-gray-700/60 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Timezone</label>
                      <select
                        value={profile.timezone}
                        onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-gray-700/60 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                      >
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Display Currency</label>
                      <select
                        value={profile.preferredCurrency}
                        onChange={e => setProfile(p => ({ ...p, preferredCurrency: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-gray-700/60 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm text-gray-400 mb-1.5">Email (read-only)</label>
                      <input
                        type="email"
                        value={user?.email || ""}
                        readOnly
                        className="w-full px-3 py-2.5 bg-gray-700/30 border border-gray-700 rounded-xl text-gray-500 cursor-not-allowed text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}

              {/* ──── Security ──── */}
              {activeTab === "security" && (
                <div className="space-y-4">
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 space-y-5">
                    <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                      <Lock className="w-5 h-5 text-cyan-400" /> Change Password
                    </h2>
                    {[
                      { label: "Current Password", key: "current" as const },
                      { label: "New Password",     key: "newPass"  as const },
                      { label: "Confirm New",       key: "confirm" as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
                        <div className="relative">
                          <input
                            type={showPass[key] ? "text" : "password"}
                            value={passwords[key]}
                            onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full px-3 py-2.5 pr-10 bg-gray-700/60 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(s => ({ ...s, [key]: !s[key] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showPass[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                    {passError && <p className="text-red-400 text-sm">{passError}</p>}
                    <button
                      onClick={handleChangePassword}
                      disabled={saving || !passwords.current || !passwords.newPass}
                      className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 text-sm"
                    >
                      {saved ? <><Check className="w-4 h-4" /> Changed!</> : "Update Password"}
                    </button>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                    <h2 className="text-white font-semibold text-lg flex items-center gap-2 mb-4">
                      <Shield className="w-5 h-5 text-cyan-400" /> Account Status
                    </h2>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-700/40">
                        <span className="text-gray-400 text-sm">Email Verified</span>
                        <span className={`text-sm font-medium ${user?.isVerified ? "text-emerald-400" : "text-yellow-400"}`}>
                          {user?.isVerified ? "✓ Yes" : "Pending"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-700/40">
                        <span className="text-gray-400 text-sm">Account Active</span>
                        <span className="text-emerald-400 text-sm font-medium">✓ Active</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-400 text-sm">Member Since</span>
                        <span className="text-white text-sm">
                          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ──── API Keys ──── */}
              {activeTab === "api" && (
                <div className="space-y-4">
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 space-y-5">
                    <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                      <Key className="w-5 h-5 text-cyan-400" /> Binance API Configuration
                    </h2>
                    <div className="p-4 rounded-xl bg-blue-900/20 border border-blue-700/30 text-blue-300 text-sm">
                      ℹ️ Binance API keys are configured via environment variables (<code className="bg-blue-900/30 px-1 rounded">BINANCE_API_KEY</code>, <code className="bg-blue-900/30 px-1 rounded">BINANCE_API_SECRET</code>) in your backend <code className="bg-blue-900/30 px-1 rounded">.env</code> file. They are not stored in the database.
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
                      <div className="relative">
                        <input
                          type={apiKeyVisible ? "text" : "password"}
                          value="••••••••••••••••••••••••••••••••"
                          readOnly
                          className="w-full px-3 py-2.5 pr-10 bg-gray-700/30 border border-gray-700 rounded-xl text-gray-500 cursor-not-allowed text-sm font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setApiKeyVisible(!apiKeyVisible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {apiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Set in backend/.env — restart containers to update</p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Network</label>
                      <div className="flex gap-3">
                        {["Testnet", "Mainnet"].map(n => (
                          <div key={n} className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                            n === "Testnet" ? "bg-orange-900/20 border-orange-700/30 text-orange-400" : "bg-gray-700/30 border-gray-700 text-gray-500"
                          }`}>
                            {n}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-1.5">Configured via <code>BINANCE_TESTNET</code> env variable</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ──── Notifications ──── */}
              {activeTab === "notifications" && (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 space-y-6">
                  <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                    <Bell className="w-5 h-5 text-cyan-400" /> Notification Preferences
                  </h2>
                  <div className="space-y-1">
                    {[
                      { key: "emailAlerts",        label: "Email Alerts",          desc: "Receive important account alerts via email" },
                      { key: "priceAlerts",         label: "Price Alerts",          desc: "Notify when assets hit your target prices" },
                      { key: "tradeConfirmations",  label: "Trade Confirmations",   desc: "Confirm every executed trade via email" },
                      { key: "weeklyReport",        label: "Weekly Summary",        desc: "Weekly portfolio performance digest" },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between py-4 border-b border-gray-700/30 last:border-0">
                        <div>
                          <p className="text-white font-medium text-sm">{label}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                        </div>
                        <Toggle
                          checked={notifs[key as keyof typeof notifs]}
                          onChange={v => setNotifs(n => ({ ...n, [key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">Note: Notification delivery depends on backend email configuration.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}