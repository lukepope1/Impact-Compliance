// Phase 1 placeholder: identity comes from a header until real auth lands (see
// server/src/middleware/auth.ts). Real auth will derive the acting user from a session/
// JWT, not a client-selectable value — this switcher exists only so the Impact and
// QALICB portals in this same dev build can demo as different logged-in users.
let ACTING_USER_EMAIL = "compliance@impactmarketplace.com";
export function setActingUser(email: string) {
  ACTING_USER_EMAIL = email;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user-email": ACTING_USER_EMAIL,
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
    headers: { "x-user-email": ACTING_USER_EMAIL },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface RequirementInstance {
  id: string;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  dueDate: string | null;
  status: string;
  isOverdue: boolean;
  requirementDefinition: { title: string; category: string; severity: string };
  responsibleParty: { legalName: string; partyRole: string } | null;
}

export interface SubmissionDocumentLink {
  documentId: string;
  evidenceRole: string | null;
  document: DocumentSummary;
}

export interface Submission {
  id: string;
  submissionVersion: number;
  status: string;
  attestationText: string | null;
  attestedAt: string | null;
  submittedAt: string | null;
  responseNote: string | null;
  documents: SubmissionDocumentLink[];
}

export interface RequirementInstanceDetail extends RequirementInstance {
  requirementDefinition: RequirementDefinition & { evidenceSchema: { requiredDocumentTypes?: string[] } };
  submissions: Submission[];
}

export interface Review {
  id: string;
  reviewStage: string;
  decision: string;
  decisionNote: string | null;
  decidedAt: string;
}

export interface IssueRow {
  id: string;
  issueType: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  resolution: string | null;
  assignedToOrganization: { legalName: string } | null;
  requirementInstance: { id: string; dueDate: string | null } | null;
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
  async downloadDocument(dealId: string, documentId: string, versionId: string, fileName: string) {
    const res = await fetch(`/api/deals/${dealId}/documents/${documentId}/versions/${versionId}/download`, {
      headers: { "x-user-email": ACTING_USER_EMAIL },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ? JSON.stringify(body.error) : `Download failed: ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  listAuditEvents: (dealId: string) => request<AuditEventRow[]>(`/deals/${dealId}/audit-events`),

  listRequirementInstances: (dealId: string) => request<RequirementInstance[]>(`/deals/${dealId}/requirement-instances`),
  generateInstances: (dealId: string, requirementDefinitionId: string) =>
    request<{ periodsConsidered: number; created: number }>(
      `/deals/${dealId}/requirement-instances/generate/${requirementDefinitionId}`,
      { method: "POST" }
    ),
  requestOnDemandInstance: (dealId: string, requirementDefinitionId: string, responseDays?: number) =>
    request<RequirementInstance>(`/deals/${dealId}/requirement-instances/request/${requirementDefinitionId}`, {
      method: "POST",
      body: JSON.stringify({ responseDays }),
    }),
  getRequirementInstance: (dealId: string, instanceId: string) =>
    request<RequirementInstanceDetail>(`/deals/${dealId}/requirement-instances/${instanceId}`),

  getOrCreateDraft: (dealId: string, instanceId: string) =>
    request<Submission>(`/deals/${dealId}/requirement-instances/${instanceId}/submissions/draft`, { method: "POST" }),
  attachEvidence: (dealId: string, instanceId: string, submissionId: string, documentId: string, evidenceRole?: string) =>
    request<SubmissionDocumentLink>(`/deals/${dealId}/requirement-instances/${instanceId}/submissions/${submissionId}/documents`, {
      method: "POST",
      body: JSON.stringify({ documentId, evidenceRole }),
    }),
  submitSubmission: (dealId: string, instanceId: string, submissionId: string, attestationText: string) =>
    request<Submission>(`/deals/${dealId}/requirement-instances/${instanceId}/submissions/${submissionId}/submit`, {
      method: "POST",
      body: JSON.stringify({ attestationText }),
    }),

  listReviewQueue: (dealId: string, stage: "impact" | "cde") =>
    request<RequirementInstance[]>(`/deals/${dealId}/requirement-instances/review-queue?stage=${stage}`),
  recordReview: (dealId: string, instanceId: string, stage: "impact" | "cde", decision: string, decisionNote?: string) =>
    request<Review>(`/deals/${dealId}/requirement-instances/${instanceId}/review`, {
      method: "POST",
      body: JSON.stringify({ stage, decision, decisionNote }),
    }),

  listIssues: (dealId: string) => request<IssueRow[]>(`/deals/${dealId}/issues`),
  createIssue: (
    dealId: string,
    data: { issueType: string; severity: string; title: string; description?: string; requirementInstanceId?: string }
  ) => request<IssueRow>(`/deals/${dealId}/issues`, { method: "POST", body: JSON.stringify(data) }),
  resolveIssue: (dealId: string, issueId: string, resolution: string) =>
    request<IssueRow>(`/deals/${dealId}/issues/${issueId}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }),
};
