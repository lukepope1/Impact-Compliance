import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, type NotificationPreferenceRow } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

/**
 * User-level settings, not portal-scoped — a QALICB admin and a CDE reviewer both reach
 * this the same way (a link from NotificationBell), since notification preferences
 * belong to the person, not whichever portal they happen to be signed into right now.
 * Not wrapped in PortalGuard (that's role-gated per portal); this just needs "signed in
 * as anyone," so it does its own lightweight auth check instead.
 */
export default function NotificationPreferences() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotificationPreferenceRow[] | null>(null);
  const [digestFrequency, setDigestFrequency] = useState<"immediate" | "daily" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingDigest, setSavingDigest] = useState(false);

  function refresh() {
    api.getNotificationPreferences().then(setRows).catch((e) => setError(String(e.message ?? e)));
    api.getEmailDigestFrequency().then((r) => setDigestFrequency(r.frequency)).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, []);

  async function changeDigest(frequency: "immediate" | "daily") {
    setSavingDigest(true);
    setError(null);
    try {
      const r = await api.setEmailDigestFrequency(frequency);
      setDigestFrequency(r.frequency);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSavingDigest(false);
    }
  }

  async function toggle(eventKey: string, channel: "in_app" | "email", current: boolean) {
    setSavingKey(`${eventKey}:${channel}`);
    setError(null);
    try {
      const updated = await api.setNotificationPreference(eventKey, channel, !current);
      setRows(updated);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <main><p className="muted is-loading">Loading…</p></main>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <main>
      <h1>Notification Preferences</h1>
      <p>
        Choose which events notify you and how. Everything is on by default — turning an option off
        only affects you, not other people on the same deal.{" "}
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1); }}>← Back</a>
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2>Email delivery</h2>
        <p style={{ marginTop: 0 }}>
          Send each enabled email as it happens, or batch them into one message per day. This applies
          across every event below — in-app notifications are always immediate either way.
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, cursor: "pointer" }}>
            <input
              type="radio"
              name="digest"
              style={{ width: "auto", accentColor: "var(--teal)" }}
              checked={digestFrequency === "immediate"}
              disabled={savingDigest || digestFrequency === null}
              onChange={() => changeDigest("immediate")}
            />
            Immediate — send as each event happens
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, cursor: "pointer" }}>
            <input
              type="radio"
              name="digest"
              style={{ width: "auto", accentColor: "var(--teal)" }}
              checked={digestFrequency === "daily"}
              disabled={savingDigest || digestFrequency === null}
              onChange={() => changeDigest("daily")}
            />
            Daily digest — one email summarizing everything
          </label>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th style={{ width: 110 }}>In-app</th>
            <th style={{ width: 110 }}>Email</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.eventKey}>
              <td>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{r.label}</div>
                <div className="text-sm muted">{r.description}</div>
              </td>
              <td>
                <input
                  type="checkbox"
                  style={{ width: "auto", accentColor: "var(--teal)", cursor: "pointer" }}
                  checked={r.inApp}
                  disabled={savingKey === `${r.eventKey}:in_app`}
                  onChange={() => toggle(r.eventKey, "in_app", r.inApp)}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  style={{ width: "auto", accentColor: "var(--teal)", cursor: "pointer" }}
                  checked={r.email}
                  disabled={savingKey === `${r.eventKey}:email`}
                  onChange={() => toggle(r.eventKey, "email", r.email)}
                />
              </td>
            </tr>
          ))}
          {rows === null && !error && (
            <tr><td className="state-cell" colSpan={3}>Loading…</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
