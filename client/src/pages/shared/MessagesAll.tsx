import { useEffect, useMemo, useState } from "react";
import { api, type Deal, type MessageRow } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" }) : "—";
}

// Same "Today"/"Yesterday"/"N days ago"/short-date shape used elsewhere (Review Queue,
// Compliance Tasks) for a real timestamp column.
function relativeDay(iso: string): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_LABEL: Record<string, string> = { open: "Open", returned: "Returned", closed: "Closed" };
const STATUS_BADGE: Record<string, string> = { open: "badge-warning", returned: "badge-navy", closed: "badge-neutral" };
const VISIBILITY_LABEL: Record<string, string> = {
  qalicb_shared: "Shared with QALICB + applicable CDE",
  deal_shared: "Shared with all deal parties",
  cde_private: "CDE + Impact only",
};

const DUE_FILTERS = ["all", "overdue", "7_days", "30_days"] as const;

type Row = MessageRow & { dealId: string; dealName: string };

/** Cross-deal request/response inbox — a lightweight thread model distinct from per-requirement Comments, with its own due date/SLA and Open/Returned/Closed lifecycle. */
export default function MessagesAll({ portal }: { portal: "impact" | "cde" | "qalicb" }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState<(typeof DUE_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ dealId: "", subject: "", body: "", slaDays: "5", visibility: "qalicb_shared" });

  function refresh() {
    api
      .listDeals()
      .then(async (deals) => {
        setDeals(deals);
        if (!draft.dealId && deals[0]) setDraft((d) => ({ ...d, dealId: deals[0].id }));
        const perDeal = await Promise.all(
          deals.map((d) => api.listMessages(d.id).then((msgs) => msgs.map((m) => ({ ...m, dealId: d.id, dealName: d.legalName }))))
        );
        const flat = perDeal.flat();
        setRows(flat);
        setSelected((prev) => (prev ? flat.find((r) => r.id === prev.id) ?? null : null));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, []);

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000);
    const in30 = new Date(now.getTime() + 30 * 86400000);

    return rows.filter((r) => {
      if (dealFilter !== "all" && r.dealId !== dealFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dueFilter === "overdue" && !(r.dueDate && r.status !== "closed" && new Date(r.dueDate) < now)) return false;
      if (dueFilter === "7_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in7)) return false;
      if (dueFilter === "30_days" && !(r.dueDate && new Date(r.dueDate) >= now && new Date(r.dueDate) <= in30)) return false;
      if (q && !r.dealName.toLowerCase().includes(q) && !(r.subject ?? r.body).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dealFilter, statusFilter, dueFilter, search]);

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.dealId || !draft.subject.trim() || !draft.body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createMessage(draft.dealId, {
        visibility: draft.visibility,
        subject: draft.subject.trim(),
        body: draft.body.trim(),
        slaDays: draft.slaDays ? Number(draft.slaDays) : undefined,
      });
      setDraft({ ...draft, subject: "", body: "" });
      setComposing(false);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.replyMessage(selected.dealId, selected.id, replyBody.trim());
      setReplyBody("");
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function closeThread() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.closeMessage(selected.dealId, selected.id);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // Server enforces the real check (sender org or Impact staff); this only decides
  // whether to show the button at all, so a name-based guess is fine here — comparing by
  // legalName since MessageRow doesn't carry the sender's raw organizationId.
  const myMembership = user?.memberships[0];
  const canClose =
    !!selected &&
    (myMembership?.organizationType === "impact_marketplace" || selected.fromOrganization.legalName === myMembership?.organizationName);

  return (
    <main>
      <h1>Messages & Lender Requests</h1>
      <p>Requests tied to a requirement use the configured response SLA.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <button onClick={() => setComposing(!composing)}>{composing ? "Cancel" : "+ New request"}</button>
        {composing && (
          <form onSubmit={sendRequest} style={{ marginTop: 12, display: "grid", gap: 8, maxWidth: 520 }}>
            <select value={draft.dealId} onChange={(e) => setDraft({ ...draft, dealId: e.target.value })}>
              {deals?.map((d) => <option key={d.id} value={d.id}>{d.legalName}</option>)}
            </select>
            <input placeholder="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            <textarea placeholder="Message" rows={3} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <label>SLA (days)
                <input type="number" style={{ width: 60 }} value={draft.slaDays} onChange={(e) => setDraft({ ...draft, slaDays: e.target.value })} />
              </label>
              <select value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}>
                <option value="qalicb_shared">Shared with QALICB + applicable CDE</option>
                <option value="deal_shared">Shared with all deal parties</option>
                <option value="cde_private">CDE + Impact only</option>
              </select>
            </div>
            <div><button type="submit" disabled={busy}>Send request</button></div>
          </form>
        )}
      </div>

      <div className="card filter-bar">
        <label>
          Deal
          <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}>
            <option value="all">All</option>
            {deals?.map((d) => <option key={d.id} value={d.id}>{d.legalName}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="returned">Returned</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          Due date
          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}>
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="7_days">Within 7 days</option>
            <option value="30_days">Within 30 days</option>
          </select>
        </label>
        <label className="filter-search">
          Search
          <input placeholder="Deal or request…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <table>
            <thead>
              <tr><th>Received</th><th>From</th><th>Request / message</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered?.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => { setSelected(r); setReplyBody(""); }}
                  style={{ cursor: "pointer", background: selected?.id === r.id ? "var(--surface-selected, #eef3fb)" : undefined }}
                >
                  <td>{relativeDay(r.createdAt)}</td>
                  <td>{r.fromOrganization.legalName}</td>
                  <td>{r.subject ?? r.body}</td>
                  <td>{fmt(r.dueDate)}</td>
                  <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                </tr>
              ))}
              {filtered && filtered.length === 0 && (
                <tr><td colSpan={5}>{rows && rows.length > 0 ? "No requests match this filter." : "No requests yet."}</td></tr>
              )}
              {!rows && !error && <tr><td colSpan={5}>Loading…</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <h2>Selected request</h2>
          {!selected && <p style={{ color: "var(--text-muted)" }}>Click a row to see its details.</p>}
          {selected && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Requirement</div>
                <div>{selected.requirementInstance ? selected.requirementInstance.requirementDefinition.title : "—"}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>SLA</div>
                <div>{selected.slaDays ? `${selected.slaDays} calendar days after request` : "—"}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Visibility</div>
                <div>{VISIBILITY_LABEL[selected.visibility] ?? selected.visibility}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 }}>Thread</div>
                <div style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
                  <strong>{selected.fromOrganization.legalName}</strong>
                  <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{new Date(selected.createdAt).toLocaleString()}</span>
                  <p style={{ margin: "4px 0 0" }}>{selected.body}</p>
                </div>
                {selected.replies.map((rep) => (
                  <div key={rep.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
                    <strong>{rep.fromOrganization.legalName}</strong>
                    <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{new Date(rep.createdAt).toLocaleString()}</span>
                    <p style={{ margin: "4px 0 0" }}>{rep.body}</p>
                  </div>
                ))}
              </div>

              {selected.status !== "closed" && (
                <div>
                  <textarea placeholder="Respond…" rows={3} style={{ width: "100%", marginBottom: 8 }} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={sendReply} disabled={busy || !replyBody.trim()}>Open task and respond</button>
                    {canClose && <button onClick={closeThread} disabled={busy}>Close thread</button>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
