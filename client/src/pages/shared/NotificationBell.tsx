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
    <div ref={containerRef} className="pos-relative d-inline-block">
      <button onClick={() => setOpen((o) => !o)} className="pos-relative">
        🔔{unreadCount > 0 && <span className="ml-4">({unreadCount})</span>}
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
          <div className="d-flex justify-between items-center mb-8">
            <strong>Notifications</strong>
            <span className="d-flex gap-8 items-center">
              {unreadCount > 0 && <button onClick={markAllRead} className="fs-12">Mark all read</button>}
              <Link to="/notifications/preferences" onClick={() => setOpen(false)} className="fs-12">
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
                <div className="fs-13">{n.subject}</div>
              ) : (
                <button
                  type="button"
                  className="cell-button fs-13 fw-600"
                  onClick={() => markRead(n.id)}
                >
                  {n.subject}
                </button>
              )}
              <div className="muted fs-12">{n.body}</div>
              <div className="muted fs-11">
                {n.deal ? `${n.deal.dealCode} · ` : ""}{fmt(n.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
