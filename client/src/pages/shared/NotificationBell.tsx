import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type NotificationRow } from "../../api/client";

function fmt(d: string) {
  return new Date(d).toLocaleString();
}

/** Shared across all three portal layouts — notifications aren't portal-specific, they belong to the logged-in user. */
export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function refresh() {
    api.listNotifications().then(setNotifications).catch(() => {});
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000); // simple poll — no websocket/SSE push in this build
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  async function markRead(id: string) {
    try {
      await api.markNotificationRead(id);
      refresh();
    } catch {
      /* best-effort — a failed read-mark isn't worth surfacing an error for */
    }
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      refresh();
    } catch {
      /* same */
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ position: "relative" }}>
        🔔{unreadCount > 0 && <span style={{ marginLeft: 4 }}>({unreadCount})</span>}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            zIndex: 20,
            width: 360,
            maxHeight: 420,
            overflowY: "auto",
            background: "white",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>Notifications</strong>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 12 }}>Mark all read</button>}
              <Link to="/notifications/preferences" onClick={() => setOpen(false)} style={{ fontSize: 12 }}>
                Settings
              </Link>
            </span>
          </div>
          {notifications && notifications.length === 0 && <p className="empty-state">Nothing yet.</p>}
          {notifications?.map((n) => (
            <div
              key={n.id}
              className="thread-item"
              style={{ background: n.readAt ? undefined : "var(--accent-tint)" }}
            >
              {/* Marking read is a real button rather than a click handler on the wrapping
                  div, which no keyboard user could reach. An already-read item has no
                  action left, so it renders as plain text instead of a dead control. */}
              {n.readAt ? (
                <div style={{ fontSize: 13 }}>{n.subject}</div>
              ) : (
                <button
                  type="button"
                  className="cell-button"
                  style={{ fontSize: 13, fontWeight: "bold" }}
                  onClick={() => markRead(n.id)}
                >
                  {n.subject}
                </button>
              )}
              <div className="muted" style={{ fontSize: 12 }}>{n.body}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {n.deal ? `${n.deal.dealCode} · ` : ""}{fmt(n.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
