// Real auth: a JWT issued by POST /api/auth/login (see server/src/routes/auth.ts),
// carried as a Bearer token. Persisted to localStorage so a refresh doesn't log the user
// out; cleared on 401 so a stale/expired token doesn't loop forever. AuthContext.tsx owns
// the higher-level login/logout flow and current-user state — this module only owns the
// token string and attaching it to every request.
const TOKEN_STORAGE_KEY = "nmtc_auth_token";
let AUTH_TOKEN: string | null = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;

export function setAuthToken(token: string | null) {
  AUTH_TOKEN = token;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAuthToken() {
  return AUTH_TOKEN;
}

/** Fired when a request comes back 401 so the app can redirect to /login. AuthContext subscribes to this. */
type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedListener | null) {
  onUnauthorized = handler;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  return AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}`, ...extra } : { ...extra };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    setAuthToken(null);
    onUnauthorized?.();
  }
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
    headers: authHeaders(),
    body: form,
  });
  if (res.status === 401) {
    setAuthToken(null);
    onUnauthorized?.();
  }
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

export interface CommentRow {
  id: string;
  body: string;
  visibility: string;
  createdAt: string;
  authorUser: { email: string; firstName: string | null; lastName: string | null };
  authorOrganization: { legalName: string };
}

export interface IssueNoteRow {
  id: string;
  body: string;
  visibility: "org_private" | "deal_shared";
  createdAt: string;
  authorUser: { email: string };
  authorOrganization: { legalName: string };
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

export interface JobRecordRow {
  id: string;
  jobTitle: string;
  fteCount: string;
  jobStatus: string | null;
  hourlyWage: string | null;
  accessibleToLicLip: boolean | null;
}

export interface TenantOccupantRow {
  id: string;
  organizationName: string;
  organizationType: string | null;
  purposeGoodsServices: string | null;
  squareFeet: string | null;
  currentEmployees: string | null;
}

export interface BenefitRecordRow {
  id: string;
  employeeClass: string;
  benefitCode: string;
  isOffered: boolean | null;
  percentReceiving: string | null;
}

export interface ServiceOutcomeRow {
  id: string;
  serviceType: string | null;
  serviceName: string;
  description: string | null;
  unitCount: string | null;
  peopleServedBaseline: string | null;
  peopleServedCurrent: string | null;
  percentLowIncome: string | null;
  outcomeNarrative: string | null;
}

export interface CbrPeriod {
  id: string;
  calendarYear: number;
  status: string;
  projectProfile: { annualGrossRevenue: string | null; projectDescription: string | null; butForStatement: string | null } | null;
  jobRecords: JobRecordRow[];
  tenantOccupants: TenantOccupantRow[];
  benefitRecords: BenefitRecordRow[];
  serviceOutcomes: ServiceOutcomeRow[];
}

export interface GoldenFieldRow {
  fieldCode: string;
  label: string;
  value: string | number | null;
  source: string;
  status: "ready" | "missing";
}

export interface SharedOutcomeSnapshotDetail {
  id: string;
  snapshotVersion: number;
  status: string;
  values: { fieldDefinition: { label: string }; valueText: string | null; valueNumber: string | null }[];
  approvals: { decision: string; decisionNote: string | null; cdeParticipation: { cdeOrganization: { legalName: string } } }[];
  controlledByCdeParticipation: { cdeOrganization: { legalName: string } } | null;
}

export interface ExportBatchRow {
  id: string;
  exportType: string;
  status: string;
  fileName: string | null;
  generatedAt: string;
}

export interface Membership {
  organizationId: string;
  organizationName: string;
  organizationType: string;
  roleCode: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  memberships: Membership[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface NotificationRow {
  id: string;
  notificationType: string;
  subject: string | null;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  deal: { dealCode: string; legalName: string } | null;
  requirementInstance: { id: string; dealId: string } | null;
}

export interface NotificationPreferenceRow {
  eventKey: string;
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<AuthUser>("/auth/me"),

  listNotifications: () => request<NotificationRow[]>("/notifications"),
  markNotificationRead: (id: string) => request<NotificationRow>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ ok: true }>("/notifications/read-all", { method: "POST" }),

  getNotificationPreferences: () => request<NotificationPreferenceRow[]>("/notifications/preferences"),
  setNotificationPreference: (eventKey: string, channel: "in_app" | "email", enabled: boolean) =>
    request<NotificationPreferenceRow[]>("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ eventKey, channel, enabled }),
    }),

  getEmailDigestFrequency: () => request<{ frequency: "immediate" | "daily" }>("/notifications/digest"),
  setEmailDigestFrequency: (frequency: "immediate" | "daily") =>
    request<{ frequency: "immediate" | "daily" }>("/notifications/digest", {
      method: "PUT",
      body: JSON.stringify({ frequency }),
    }),

  listDeals: () => request<Deal[]>("/deals"),
  getDeal: (id: string) => request<Deal>(`/deals/${id}`),
  createDeal: (data: { dealCode: string; legalName: string; projectName?: string; isMultiCde: boolean }) =>
    request<Deal>("/deals", { method: "POST", body: JSON.stringify(data) }),
  updateDeal: (id: string, data: Partial<Deal>) =>
    request<Deal>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateDealStatus: (id: string, status: string, statusChangeReason?: string) =>
    request<Deal>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify({ status, statusChangeReason }) }),

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
  getDocument: (dealId: string, documentId: string) => request<DocumentSummary>(`/deals/${dealId}/documents/${documentId}`),
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
  rescanVersion: (dealId: string, documentId: string, versionId: string) =>
    request<DocumentVersionSummary>(`/deals/${dealId}/documents/${documentId}/versions/${versionId}/rescan`, { method: "POST" }),
  async downloadDocument(dealId: string, documentId: string, versionId: string, fileName: string) {
    const res = await fetch(`/api/deals/${dealId}/documents/${documentId}/versions/${versionId}/download`, {
      headers: authHeaders(),
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

  listComments: (dealId: string, instanceId: string) =>
    request<CommentRow[]>(`/deals/${dealId}/requirement-instances/${instanceId}/comments`),
  postComment: (dealId: string, instanceId: string, body: string, visibility: string) =>
    request<CommentRow>(`/deals/${dealId}/requirement-instances/${instanceId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, visibility }),
    }),

  listIssues: (dealId: string) => request<IssueRow[]>(`/deals/${dealId}/issues`),
  createIssue: (
    dealId: string,
    data: { issueType: string; severity: string; title: string; description?: string; requirementInstanceId?: string }
  ) => request<IssueRow>(`/deals/${dealId}/issues`, { method: "POST", body: JSON.stringify(data) }),
  resolveIssue: (dealId: string, issueId: string, resolution: string) =>
    request<IssueRow>(`/deals/${dealId}/issues/${issueId}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }),

  listIssueNotes: (dealId: string, issueId: string) =>
    request<IssueNoteRow[]>(`/deals/${dealId}/issues/${issueId}/notes`),
  postIssueNote: (dealId: string, issueId: string, body: string, visibility: "org_private" | "deal_shared") =>
    request<IssueNoteRow>(`/deals/${dealId}/issues/${issueId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body, visibility }),
    }),

  getCbrPeriod: (dealId: string, year: number) => request<CbrPeriod>(`/deals/${dealId}/cbr/${year}`),
  saveCbrProfile: (dealId: string, year: number, data: { annualGrossRevenue?: number; projectDescription?: string; butForStatement?: string }) =>
    request<unknown>(`/deals/${dealId}/cbr/${year}/profile`, { method: "PUT", body: JSON.stringify(data) }),
  addJobRecord: (dealId: string, year: number, data: { jobTitle: string; fteCount: number; jobStatus?: string; hourlyWage?: number; accessibleToLicLip?: boolean }) =>
    request<JobRecordRow>(`/deals/${dealId}/cbr/${year}/jobs`, { method: "POST", body: JSON.stringify(data) }),
  addTenant: (dealId: string, year: number, data: { organizationName: string; organizationType?: string; purposeGoodsServices?: string; squareFeet?: number; currentEmployees?: number }) =>
    request<TenantOccupantRow>(`/deals/${dealId}/cbr/${year}/tenants`, { method: "POST", body: JSON.stringify(data) }),
  saveBenefit: (dealId: string, year: number, data: { employeeClass: string; benefitCode: string; isOffered?: boolean; percentReceiving?: number }) =>
    request<BenefitRecordRow>(`/deals/${dealId}/cbr/${year}/benefits`, { method: "PUT", body: JSON.stringify(data) }),
  addServiceOutcome: (
    dealId: string,
    year: number,
    data: {
      serviceType?: string;
      serviceName: string;
      description?: string;
      unitCount?: number;
      peopleServedBaseline?: number;
      peopleServedCurrent?: number;
      percentLowIncome?: number;
      outcomeNarrative?: string;
    }
  ) => request<ServiceOutcomeRow>(`/deals/${dealId}/cbr/${year}/service-outcomes`, { method: "POST", body: JSON.stringify(data) }),

  getSnapshot: (dealId: string, year: number) => request<SharedOutcomeSnapshotDetail | null>(`/deals/${dealId}/snapshots/${year}`),
  generateSnapshot: (dealId: string, year: number) =>
    request<SharedOutcomeSnapshotDetail>(`/deals/${dealId}/snapshots/${year}/generate`, { method: "POST" }),
  decideSnapshot: (dealId: string, snapshotId: string, decision: string, decisionNote?: string) =>
    request<unknown>(`/deals/${dealId}/snapshots/${snapshotId}/approve`, { method: "POST", body: JSON.stringify({ decision, decisionNote }) }),

  getAmisReadiness: (dealId: string, year: number) => request<GoldenFieldRow[]>(`/deals/${dealId}/amis/readiness/${year}`),
  listAmisExports: (dealId: string) => request<ExportBatchRow[]>(`/deals/${dealId}/amis/exports`),
  generateAmisExport: (dealId: string, year: number) =>
    request<ExportBatchRow>(`/deals/${dealId}/amis/exports/${year}`, { method: "POST" }),
  async downloadAmisExport(dealId: string, exportId: string, fileName: string) {
    const res = await fetch(`/api/deals/${dealId}/amis/exports/${exportId}/download`, { headers: authHeaders() });
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
};
