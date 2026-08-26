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
  closingDate: string | null;
  complianceEndDate: string | null;
  multiCdeProjectNumber: string | null;
  updatedAt: string;
}

export interface DealParty {
  id: string;
  legalName: string;
  partyRole: string;
  isReportingParty: boolean;
  organizationId: string | null;
}

export interface Organization {
  id: string;
  legalName: string;
  organizationType: string;
}

export interface CdeParticipation {
  id: string;
  subCdeName: string | null;
  allocationControlNumber: string | null;
  isLeadCde: boolean;
  cdeOrganization: Organization;
}

export interface RequirementSource {
  id: string;
  sourceDocumentName: string;
  sectionReference: string | null;
  sourceExcerpt: string | null;
  sourcePriority: number;
}

export interface RequirementDefinition {
  id: string;
  requirementCode: string;
  version: number;
  title: string;
  category: string;
  cadence: string;
  severity: string;
  status: string;
  conflictStatus: string;
  conflictResolutionNote: string | null;
  dueRule: Record<string, unknown>;
  sources: RequirementSource[];
}

export interface DocumentVersionSummary {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSizeBytes: string | number | null;
  sha256Checksum: string;
  malwareScanStatus: string;
  uploadedAt: string;
  supersededAt: string | null;
}

export interface DocumentSummary {
  id: string;
  documentType: string;
  title: string;
  shareScope: string;
  status: string;
  currentVersion: number;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  createdAt: string;
  versions: DocumentVersionSummary[];
}

export interface AuditEventRow {
  id: string;
  occurredAt: string;
  objectType: string;
  objectId: string | null;
  action: string;
  actorUser: { email: string } | null;
  actorOrganization: { legalName: string } | null;
}

async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "x-user-email": DEV_USER_EMAIL },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  listDeals: () => request<Deal[]>("/deals"),
  getDeal: (id: string) => request<Deal>(`/deals/${id}`),
  createDeal: (data: { dealCode: string; legalName: string; projectName?: string; isMultiCde: boolean }) =>
    request<Deal>("/deals", { method: "POST", body: JSON.stringify(data) }),
  updateDeal: (id: string, data: Partial<Deal>) =>
    request<Deal>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listOrganizations: (type?: string) =>
    request<Organization[]>(`/organizations${type ? `?type=${type}` : ""}`),

  listParties: (dealId: string) => request<DealParty[]>(`/deals/${dealId}/parties`),
  createParty: (dealId: string, data: { legalName: string; partyRole: string; organizationId?: string; isReportingParty?: boolean }) =>
    request<DealParty>(`/deals/${dealId}/parties`, { method: "POST", body: JSON.stringify(data) }),

  listCdeParticipations: (dealId: string) => request<CdeParticipation[]>(`/deals/${dealId}/cde-participations`),
  createCdeParticipation: (
    dealId: string,
    data: { cdeOrganizationId: string; subCdeName?: string; allocationControlNumber?: string; isLeadCde?: boolean }
  ) => request<CdeParticipation>(`/deals/${dealId}/cde-participations`, { method: "POST", body: JSON.stringify(data) }),

  listRequirementDefinitions: (dealId: string) =>
    request<RequirementDefinition[]>(`/deals/${dealId}/requirement-definitions`),
  createRequirementDefinition: (
    dealId: string,
    data: {
      requirementCode: string;
      title: string;
      category: string;
      cadence: string;
      dueRule: Record<string, unknown>;
      severity?: string;
      sources?: { sourceDocumentName: string; sectionReference?: string; sourceExcerpt?: string }[];
    }
  ) => request<RequirementDefinition>(`/deals/${dealId}/requirement-definitions`, { method: "POST", body: JSON.stringify(data) }),
  publishRequirementDefinition: (dealId: string, id: string) =>
    request<RequirementDefinition>(`/deals/${dealId}/requirement-definitions/${id}/publish`, { method: "POST" }),
  resolveConflict: (dealId: string, id: string, data: { conflictStatus: string; conflictResolutionNote: string }) =>
    request<RequirementDefinition>(`/deals/${dealId}/requirement-definitions/${id}/conflict`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listDocuments: (dealId: string) => request<DocumentSummary[]>(`/deals/${dealId}/documents`),
  uploadDocument: (
    dealId: string,
    file: File,
    meta: { documentType: string; title: string; shareScope: string }
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("documentType", meta.documentType);
    form.append("title", meta.title);
    form.append("shareScope", meta.shareScope);
    return requestForm<DocumentSummary>(`/deals/${dealId}/documents`, form);
  },
  uploadNewVersion: (dealId: string, documentId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return requestForm<DocumentVersionSummary>(`/deals/${dealId}/documents/${documentId}/versions`, form);
  },
  downloadUrl: (dealId: string, documentId: string, versionId: string) =>
    `/api/deals/${dealId}/documents/${documentId}/versions/${versionId}/download`,

  listAuditEvents: (dealId: string) => request<AuditEventRow[]>(`/deals/${dealId}/audit-events`),
};
