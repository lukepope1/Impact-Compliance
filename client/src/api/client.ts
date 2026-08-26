// Phase 1 placeholder: identity comes from a header until real auth lands (see server/src/middleware/auth.ts).
const DEV_USER_EMAIL = "compliance@impactmarketplace.com";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user-email": DEV_USER_EMAIL,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface Deal {
  id: string;
  dealCode: string;
  legalName: string;
  projectName: string | null;
  status: string;
  isMultiCde: boolean;
  updatedAt: string;
}

export const api = {
  listDeals: () => request<Deal[]>("/deals"),
  getDeal: (id: string) => request<Deal>(`/deals/${id}`),
};
