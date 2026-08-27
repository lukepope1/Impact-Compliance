import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function NewDeal() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ dealCode: "", legalName: "", projectName: "", isMultiCde: false });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const deal = await api.createDeal(form);
      navigate(`/impact/deals/${deal.id}/setup`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  return (
    <main>
      <h1>New Deal</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <form className="card form-stack" onSubmit={submit} style={{ maxWidth: 420 }}>
        <label>Deal code
          <input value={form.dealCode} onChange={(e) => setForm({ ...form, dealCode: e.target.value })} required />
        </label>
        <label>Legal name
          <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} required />
        </label>
        <label>Project name
          <input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
        </label>
        <label>
          <input type="checkbox" checked={form.isMultiCde} onChange={(e) => setForm({ ...form, isMultiCde: e.target.checked })} /> Multi-CDE deal
        </label>
        <button type="submit">Create deal</button>
      </form>
    </main>
  );
}
