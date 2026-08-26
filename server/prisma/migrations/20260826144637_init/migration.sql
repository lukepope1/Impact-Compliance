-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('impact_marketplace', 'qalicb', 'borrower', 'guarantor', 'tenant', 'cde', 'allocatee', 'investor', 'other');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('impact_super_admin', 'impact_compliance_manager', 'impact_analyst', 'qalicb_admin', 'qalicb_contributor', 'cde_admin', 'cde_reviewer', 'cde_viewer');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('onboarding', 'active', 'exception', 'winding_down', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "DealRole" AS ENUM ('impact_manager', 'qalicb', 'borrower', 'guarantor', 'tenant', 'cde', 'allocatee', 'investor', 'other');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('borrower', 'qalicb', 'project_business', 'guarantor', 'tenant', 'cde_lender', 'allocatee', 'investment_fund', 'investor', 'leverage_lender', 'property_owner', 'operating_company', 'other');

-- CreateEnum
CREATE TYPE "QliciType" AS ENUM ('loan', 'equity', 'purchase_loan', 'financial_counseling', 'cde_investment');

-- CreateEnum
CREATE TYPE "QliciStatus" AS ENUM ('pending', 'active', 'paid', 'closed');

-- CreateEnum
CREATE TYPE "ShareScope" AS ENUM ('impact_only', 'qalicb_and_impact', 'deal_shared', 'selected_cdes', 'cde_private');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('active', 'superseded', 'quarantined', 'deleted');

-- CreateEnum
CREATE TYPE "MalwareScanStatus" AS ENUM ('pending', 'clean', 'infected', 'failed');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('view', 'download', 'review');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('document_collection', 'structured_reporting', 'calculation_test', 'certification_attestation', 'event_notice', 'consent_approval', 'restriction_covenant', 'payment_fee', 'regulatory_filing', 'retention');

-- CreateEnum
CREATE TYPE "RequirementCadence" AS ENUM ('one_time', 'monthly', 'quarterly', 'semiannual', 'annual', 'fixed_dates', 'on_request', 'event_driven');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateEnum
CREATE TYPE "RequirementDefStatus" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('none', 'suspected', 'confirmed', 'resolved');

-- CreateEnum
CREATE TYPE "RequirementInstanceStatus" AS ENUM ('not_due', 'upcoming', 'awaiting_qalicb', 'draft_submitted', 'submitted', 'impact_review', 'returned', 'impact_approved', 'cde_review', 'cde_approved', 'amis_ready', 'exported_filed', 'closed', 'waived');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('draft', 'submitted', 'returned', 'superseded', 'approved');

-- CreateEnum
CREATE TYPE "FieldModule" AS ENUM ('project', 'financial', 'qalicb_test', 'community_benefits', 'amis', 'other');

-- CreateEnum
CREATE TYPE "FieldDataType" AS ENUM ('text', 'integer', 'decimal', 'currency', 'percent', 'boolean', 'date', 'datetime', 'json');

-- CreateEnum
CREATE TYPE "EntryMethod" AS ENUM ('manual', 'import', 'extracted', 'calculated');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('unreviewed', 'valid', 'warning', 'invalid');

-- CreateEnum
CREATE TYPE "ReviewStage" AS ENUM ('impact', 'cde');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('approved', 'returned', 'acknowledged', 'waived');

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('qalicb_shared', 'deal_shared', 'impact_private', 'cde_private');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('missing_item', 'late_item', 'data_variance', 'covenant_exception', 'source_conflict', 'material_event_candidate', 'amis_validation', 'security', 'other');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'in_review', 'waiting_external', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "CbrPeriodStatus" AS ENUM ('not_started', 'draft', 'submitted', 'impact_review', 'cde_review', 'approved', 'closed');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('retained', 'created', 'construction');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'temporary', 'other');

-- CreateEnum
CREATE TYPE "EmployeeClass" AS ENUM ('permanent', 'temporary', 'construction', 'other');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('draft', 'impact_approved', 'cde_review', 'locked');

-- CreateEnum
CREATE TYPE "SnapshotApprovalDecision" AS ENUM ('pending', 'approved', 'changes_requested', 'not_reporting');

-- CreateEnum
CREATE TYPE "AmisTransport" AS ENUM ('csv', 'xml', 'manual_review_xlsx');

-- CreateEnum
CREATE TYPE "AmisMappingStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('review_xlsx', 'amis_csv', 'amis_xml');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('building', 'validation_failed', 'ready', 'downloaded', 'filed_manual', 'certified_manual', 'superseded');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "organization_type" "OrganizationType" NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT,
    "ein_last4" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'active',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "external_auth_subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "mfa_required" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_code" "RoleCode" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "deal_code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "project_name" TEXT,
    "project_description" TEXT,
    "closing_date" DATE,
    "compliance_start_date" DATE,
    "compliance_end_date" DATE,
    "fiscal_year_end_month" INTEGER NOT NULL DEFAULT 12,
    "fiscal_year_end_day" INTEGER NOT NULL DEFAULT 31,
    "status" "DealStatus" NOT NULL DEFAULT 'onboarding',
    "is_multi_cde" BOOLEAN NOT NULL DEFAULT false,
    "multi_cde_project_number" TEXT,
    "multi_cde_address_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_organization_access" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_role" "DealRole" NOT NULL,
    "can_view_shared_evidence" BOOLEAN NOT NULL DEFAULT false,
    "can_submit" BOOLEAN NOT NULL DEFAULT false,
    "can_review" BOOLEAN NOT NULL DEFAULT false,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,
    "can_export" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_organization_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_parties" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "legal_name" TEXT NOT NULL,
    "party_role" "PartyRole" NOT NULL,
    "is_reporting_party" BOOLEAN NOT NULL DEFAULT false,
    "fiscal_year_end_month" INTEGER,
    "fiscal_year_end_day" INTEGER,
    "naics_code" TEXT,
    "entity_type" TEXT,
    "active_from" DATE,
    "active_to" DATE,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cde_participations" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "cde_organization_id" TEXT NOT NULL,
    "allocatee_organization_id" TEXT,
    "sub_cde_name" TEXT,
    "allocation_control_number" TEXT,
    "qei_amount" DECIMAL(18,2),
    "allocation_amount" DECIMAL(18,2),
    "is_lead_cde" BOOLEAN NOT NULL DEFAULT false,
    "private_settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cde_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_addresses" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "address_type" TEXT NOT NULL DEFAULT 'primary',
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "postal_code" TEXT NOT NULL,
    "postal_code_plus4" TEXT,
    "county" TEXT,
    "census_tract" TEXT,
    "longitude" DECIMAL(12,8),
    "latitude" DECIMAL(11,8),
    "cims_address_id" TEXT,
    "eligibility_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qlicis" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "cde_participation_id" TEXT NOT NULL,
    "qlici_code" TEXT NOT NULL,
    "qlici_type" "QliciType" NOT NULL DEFAULT 'loan',
    "note_class" TEXT,
    "original_principal" DECIMAL(18,2),
    "current_principal" DECIMAL(18,2),
    "interest_rate" DECIMAL(9,6),
    "maturity_date" DATE,
    "qlici_date" DATE,
    "status" "QliciStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qlicis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT,
    "owner_organization_id" TEXT,
    "document_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "legal_entity_party_id" TEXT,
    "reporting_period_start" DATE,
    "reporting_period_end" DATE,
    "share_scope" "ShareScope" NOT NULL DEFAULT 'impact_only',
    "status" "DocumentStatus" NOT NULL DEFAULT 'active',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "s3_bucket" TEXT NOT NULL,
    "s3_object_key" TEXT NOT NULL,
    "s3_version_id" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT,
    "sha256_checksum" TEXT NOT NULL,
    "kms_key_arn" TEXT,
    "malware_scan_status" "MalwareScanStatus" NOT NULL DEFAULT 'pending',
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_grants" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "access_level" "DocumentAccessLevel" NOT NULL DEFAULT 'view',
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "document_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_definitions" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "requirement_code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "cadence" "RequirementCadence" NOT NULL,
    "applies_to_party_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "due_rule" JSONB NOT NULL,
    "evidence_schema" JSONB NOT NULL DEFAULT '{}',
    "validation_rules" JSONB NOT NULL DEFAULT '[]',
    "review_workflow" JSONB NOT NULL DEFAULT '[]',
    "reminder_rule" JSONB NOT NULL DEFAULT '{}',
    "share_scope" TEXT NOT NULL DEFAULT 'deal_shared',
    "severity" "Severity" NOT NULL DEFAULT 'normal',
    "effective_from" DATE,
    "effective_to" DATE,
    "status" "RequirementDefStatus" NOT NULL DEFAULT 'draft',
    "conflict_status" "ConflictStatus" NOT NULL DEFAULT 'none',
    "conflict_resolution_note" TEXT,
    "created_by" TEXT,
    "published_by" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_sources" (
    "id" TEXT NOT NULL,
    "requirement_definition_id" TEXT NOT NULL,
    "source_document_id" TEXT,
    "source_document_name" TEXT NOT NULL,
    "section_reference" TEXT,
    "exhibit_reference" TEXT,
    "page_reference" TEXT,
    "source_excerpt" TEXT,
    "source_excerpt_hash" TEXT,
    "source_effective_date" DATE,
    "source_priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_instances" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "requirement_definition_id" TEXT NOT NULL,
    "definition_version" INTEGER NOT NULL,
    "responsible_party_id" TEXT,
    "reporting_period_start" DATE,
    "reporting_period_end" DATE,
    "due_date" DATE,
    "due_date_basis" JSONB NOT NULL DEFAULT '{}',
    "requested_at" TIMESTAMP(3),
    "status" "RequirementInstanceStatus" NOT NULL DEFAULT 'not_due',
    "is_overdue" BOOLEAN NOT NULL DEFAULT false,
    "is_exception" BOOLEAN NOT NULL DEFAULT false,
    "current_submission_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "requirement_instance_id" TEXT NOT NULL,
    "submission_version" INTEGER NOT NULL,
    "submitted_by_organization_id" TEXT NOT NULL,
    "submitted_by_user_id" TEXT NOT NULL,
    "attested_by_user_id" TEXT,
    "attestation_text" TEXT,
    "attested_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "status" "SubmissionStatus" NOT NULL DEFAULT 'draft',
    "response_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_documents" (
    "submission_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "evidence_role" TEXT,

    CONSTRAINT "submission_documents_pkey" PRIMARY KEY ("submission_id","document_id")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" TEXT NOT NULL,
    "field_code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "module" "FieldModule" NOT NULL,
    "data_type" "FieldDataType" NOT NULL,
    "unit" TEXT,
    "option_values" JSONB,
    "validation" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_values" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "field_definition_id" TEXT NOT NULL,
    "reporting_party_id" TEXT,
    "reporting_period_start" DATE,
    "reporting_period_end" DATE,
    "value_text" TEXT,
    "value_number" DECIMAL(24,8),
    "value_boolean" BOOLEAN,
    "value_date" DATE,
    "value_json" JSONB,
    "source_submission_id" TEXT,
    "source_document_id" TEXT,
    "source_document_version_id" TEXT,
    "entered_by" TEXT,
    "entry_method" "EntryMethod" NOT NULL DEFAULT 'manual',
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'unreviewed',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "superseded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structured_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "requirement_instance_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "review_stage" "ReviewStage" NOT NULL,
    "reviewing_organization_id" TEXT NOT NULL,
    "reviewer_user_id" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "requirement_instance_id" TEXT,
    "submission_id" TEXT,
    "author_user_id" TEXT NOT NULL,
    "author_organization_id" TEXT NOT NULL,
    "visibility" "CommentVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "requirement_instance_id" TEXT,
    "issue_type" "IssueType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to_user_id" TEXT,
    "assigned_to_organization_id" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "due_date" DATE,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbr_reporting_periods" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "calendar_year" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "CbrPeriodStatus" NOT NULL DEFAULT 'not_started',
    "target_snapshot_date" DATE,
    "prior_period_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbr_reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbr_project_profiles" (
    "id" TEXT NOT NULL,
    "cbr_period_id" TEXT NOT NULL,
    "project_description" TEXT,
    "but_for_statement" TEXT,
    "lic_benefit_description" TEXT,
    "new_services_description" TEXT,
    "revitalization_plan" TEXT,
    "private_investment_stabilization" TEXT,
    "annual_gross_revenue" DECIMAL(18,2),
    "annual_net_operating_income" DECIMAL(18,2),
    "federal_tax_estimate" DECIMAL(18,2),
    "state_tax_estimate" DECIMAL(18,2),
    "community_engagement" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cbr_project_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_records" (
    "id" TEXT NOT NULL,
    "cbr_period_id" TEXT NOT NULL,
    "employer_party_id" TEXT,
    "job_title" TEXT NOT NULL,
    "fte_count" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "job_status" "JobStatus",
    "employment_type" "EmploymentType",
    "hourly_wage" DECIMAL(12,2),
    "annual_salary" DECIMAL(18,2),
    "hours_per_week" DECIMAL(8,2),
    "benefits_burden_percent" DECIMAL(7,4),
    "accessible_to_lic_lip" BOOLEAN,
    "college_degree_required" BOOLEAN,
    "minimum_education_level" TEXT,
    "training_provided" BOOLEAN,
    "employees_eligible_healthcare" DECIMAL(12,4),
    "employees_enrolled_healthcare" DECIMAL(12,4),
    "source_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_records" (
    "id" TEXT NOT NULL,
    "cbr_period_id" TEXT NOT NULL,
    "employer_party_id" TEXT,
    "employee_class" "EmployeeClass" NOT NULL,
    "benefit_code" TEXT NOT NULL,
    "is_offered" BOOLEAN,
    "percent_receiving" DECIMAL(7,4),
    "detail" TEXT,

    CONSTRAINT "benefit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_occupants" (
    "id" TEXT NOT NULL,
    "cbr_period_id" TEXT NOT NULL,
    "tenant_party_id" TEXT,
    "organization_name" TEXT NOT NULL,
    "organization_type" TEXT,
    "purpose_goods_services" TEXT,
    "lease_start" DATE,
    "lease_end" DATE,
    "square_feet" DECIMAL(18,2),
    "current_employees" DECIMAL(12,2),
    "average_hourly_wage" DECIMAL(12,2),
    "employees_receiving_medical" DECIMAL(12,2),
    "jobs_hs_or_less" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_occupants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_outcomes" (
    "id" TEXT NOT NULL,
    "cbr_period_id" TEXT NOT NULL,
    "service_type" TEXT,
    "service_name" TEXT NOT NULL,
    "description" TEXT,
    "unit_count" DECIMAL(18,4),
    "square_feet" DECIMAL(18,2),
    "people_served_baseline" DECIMAL(18,2),
    "people_served_current" DECIMAL(18,2),
    "percent_low_income" DECIMAL(7,4),
    "percent_people_of_color" DECIMAL(7,4),
    "outcomeNarrative" TEXT,
    "success_indicators" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_outcome_snapshots" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "reporting_period_end" DATE NOT NULL,
    "snapshot_version" INTEGER NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'draft',
    "controlled_by_cde_participation_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),

    CONSTRAINT "shared_outcome_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_outcome_values" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "field_definition_id" TEXT NOT NULL,
    "value_text" TEXT,
    "value_number" DECIMAL(24,8),
    "value_boolean" BOOLEAN,
    "value_date" DATE,
    "source_structured_value_id" TEXT,

    CONSTRAINT "shared_outcome_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cde_snapshot_approvals" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "cde_participation_id" TEXT NOT NULL,
    "decision" "SnapshotApprovalDecision" NOT NULL DEFAULT 'pending',
    "decided_by" TEXT,
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "cde_snapshot_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amis_mapping_versions" (
    "id" TEXT NOT NULL,
    "mapping_name" TEXT NOT NULL,
    "version_code" TEXT NOT NULL,
    "transport" "AmisTransport" NOT NULL,
    "effective_from" DATE,
    "effective_to" DATE,
    "template_file_name" TEXT,
    "template_checksum" TEXT,
    "schema_file_name" TEXT,
    "schema_checksum" TEXT,
    "status" "AmisMappingStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amis_mapping_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amis_field_mappings" (
    "id" TEXT NOT NULL,
    "mapping_version_id" TEXT NOT NULL,
    "internal_field_code" TEXT NOT NULL,
    "field_definition_id" TEXT,
    "amis_object" TEXT NOT NULL,
    "amis_field_name" TEXT NOT NULL,
    "transform_rule" TEXT,
    "conditional_rule" TEXT,
    "validation_rules" JSONB NOT NULL DEFAULT '[]',
    "source_preference" JSONB NOT NULL DEFAULT '[]',
    "approval_role" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "amis_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_batches" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT,
    "cde_participation_id" TEXT,
    "mapping_version_id" TEXT NOT NULL,
    "reporting_period_end" DATE,
    "export_type" "ExportType" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'building',
    "s3_bucket" TEXT,
    "s3_object_key" TEXT,
    "file_name" TEXT,
    "file_checksum" TEXT,
    "validation_results" JSONB NOT NULL DEFAULT '[]',
    "generated_by" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filed_at" TIMESTAMP(3),
    "certified_at" TIMESTAMP(3),

    CONSTRAINT "export_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_field_lineage" (
    "id" TEXT NOT NULL,
    "export_batch_id" TEXT NOT NULL,
    "amis_field_mapping_id" TEXT NOT NULL,
    "output_row_key" TEXT,
    "output_field_name" TEXT NOT NULL,
    "output_value" TEXT,
    "source_structured_value_id" TEXT,
    "source_snapshot_value_id" TEXT,
    "source_document_id" TEXT,
    "source_review_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_field_lineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "deal_id" TEXT,
    "requirement_instance_id" TEXT,
    "notification_type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" TEXT,
    "actor_organization_id" TEXT,
    "deal_id" TEXT,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_external_auth_subject_key" ON "users"("external_auth_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organization_id_user_id_role_code_key" ON "organization_memberships"("organization_id", "user_id", "role_code");

-- CreateIndex
CREATE UNIQUE INDEX "deals_deal_code_key" ON "deals"("deal_code");

-- CreateIndex
CREATE INDEX "deal_organization_access_organization_id_deal_id_idx" ON "deal_organization_access"("organization_id", "deal_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_organization_access_deal_id_organization_id_deal_role_key" ON "deal_organization_access"("deal_id", "organization_id", "deal_role");

-- CreateIndex
CREATE INDEX "deal_parties_deal_id_party_role_idx" ON "deal_parties"("deal_id", "party_role");

-- CreateIndex
CREATE UNIQUE INDEX "cde_participations_deal_id_cde_organization_id_key" ON "cde_participations"("deal_id", "cde_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "qlicis_deal_id_cde_participation_id_qlici_code_key" ON "qlicis"("deal_id", "cde_participation_id", "qlici_code");

-- CreateIndex
CREATE INDEX "documents_deal_id_document_type_reporting_period_end_idx" ON "documents"("deal_id", "document_type", "reporting_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_s3_bucket_s3_object_key_s3_version_id_key" ON "document_versions"("s3_bucket", "s3_object_key", "s3_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_access_grants_document_id_organization_id_key" ON "document_access_grants"("document_id", "organization_id");

-- CreateIndex
CREATE INDEX "requirement_definitions_deal_id_status_idx" ON "requirement_definitions"("deal_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_definitions_deal_id_requirement_code_version_key" ON "requirement_definitions"("deal_id", "requirement_code", "version");

-- CreateIndex
CREATE INDEX "requirement_instances_deal_id_due_date_status_idx" ON "requirement_instances"("deal_id", "due_date", "status");

-- CreateIndex
CREATE INDEX "requirement_instances_responsible_party_id_due_date_idx" ON "requirement_instances"("responsible_party_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_instances_requirement_definition_id_responsible_key" ON "requirement_instances"("requirement_definition_id", "responsible_party_id", "reporting_period_start", "reporting_period_end", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_requirement_instance_id_submission_version_key" ON "submissions"("requirement_instance_id", "submission_version");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_field_code_version_key" ON "field_definitions"("field_code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "structured_values_superseded_by_key" ON "structured_values"("superseded_by");

-- CreateIndex
CREATE INDEX "structured_values_deal_id_field_definition_id_reporting_per_idx" ON "structured_values"("deal_id", "field_definition_id", "reporting_period_end");

-- CreateIndex
CREATE INDEX "reviews_requirement_instance_id_review_stage_decided_at_idx" ON "reviews"("requirement_instance_id", "review_stage", "decided_at" DESC);

-- CreateIndex
CREATE INDEX "issues_deal_id_status_severity_idx" ON "issues"("deal_id", "status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "cbr_reporting_periods_deal_id_calendar_year_key" ON "cbr_reporting_periods"("deal_id", "calendar_year");

-- CreateIndex
CREATE UNIQUE INDEX "cbr_project_profiles_cbr_period_id_key" ON "cbr_project_profiles"("cbr_period_id");

-- CreateIndex
CREATE INDEX "job_records_cbr_period_id_job_status_idx" ON "job_records"("cbr_period_id", "job_status");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_records_cbr_period_id_employer_party_id_employee_cl_key" ON "benefit_records"("cbr_period_id", "employer_party_id", "employee_class", "benefit_code");

-- CreateIndex
CREATE UNIQUE INDEX "shared_outcome_snapshots_deal_id_reporting_period_end_snaps_key" ON "shared_outcome_snapshots"("deal_id", "reporting_period_end", "snapshot_version");

-- CreateIndex
CREATE UNIQUE INDEX "shared_outcome_values_source_structured_value_id_key" ON "shared_outcome_values"("source_structured_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_outcome_values_snapshot_id_field_definition_id_key" ON "shared_outcome_values"("snapshot_id", "field_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "cde_snapshot_approvals_snapshot_id_cde_participation_id_key" ON "cde_snapshot_approvals"("snapshot_id", "cde_participation_id");

-- CreateIndex
CREATE UNIQUE INDEX "amis_mapping_versions_mapping_name_version_code_transport_key" ON "amis_mapping_versions"("mapping_name", "version_code", "transport");

-- CreateIndex
CREATE UNIQUE INDEX "amis_field_mappings_mapping_version_id_amis_object_amis_fie_key" ON "amis_field_mappings"("mapping_version_id", "amis_object", "amis_field_name");

-- CreateIndex
CREATE INDEX "export_batches_deal_id_status_generated_at_idx" ON "export_batches"("deal_id", "status", "generated_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_deal_id_occurred_at_idx" ON "audit_events"("deal_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_object_type_object_id_occurred_at_idx" ON "audit_events"("object_type", "object_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_organization_access" ADD CONSTRAINT "deal_organization_access_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_organization_access" ADD CONSTRAINT "deal_organization_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_parties" ADD CONSTRAINT "deal_parties_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_parties" ADD CONSTRAINT "deal_parties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cde_participations" ADD CONSTRAINT "cde_participations_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cde_participations" ADD CONSTRAINT "cde_participations_cde_organization_id_fkey" FOREIGN KEY ("cde_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cde_participations" ADD CONSTRAINT "cde_participations_allocatee_organization_id_fkey" FOREIGN KEY ("allocatee_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_addresses" ADD CONSTRAINT "project_addresses_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qlicis" ADD CONSTRAINT "qlicis_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qlicis" ADD CONSTRAINT "qlicis_cde_participation_id_fkey" FOREIGN KEY ("cde_participation_id") REFERENCES "cde_participations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_organization_id_fkey" FOREIGN KEY ("owner_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_legal_entity_party_id_fkey" FOREIGN KEY ("legal_entity_party_id") REFERENCES "deal_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_grants" ADD CONSTRAINT "document_access_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_definitions" ADD CONSTRAINT "requirement_definitions_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_definitions" ADD CONSTRAINT "requirement_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_definitions" ADD CONSTRAINT "requirement_definitions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_sources" ADD CONSTRAINT "requirement_sources_requirement_definition_id_fkey" FOREIGN KEY ("requirement_definition_id") REFERENCES "requirement_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_sources" ADD CONSTRAINT "requirement_sources_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_instances" ADD CONSTRAINT "requirement_instances_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_instances" ADD CONSTRAINT "requirement_instances_requirement_definition_id_fkey" FOREIGN KEY ("requirement_definition_id") REFERENCES "requirement_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_instances" ADD CONSTRAINT "requirement_instances_responsible_party_id_fkey" FOREIGN KEY ("responsible_party_id") REFERENCES "deal_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_requirement_instance_id_fkey" FOREIGN KEY ("requirement_instance_id") REFERENCES "requirement_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_attested_by_user_id_fkey" FOREIGN KEY ("attested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_reporting_party_id_fkey" FOREIGN KEY ("reporting_party_id") REFERENCES "deal_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_source_submission_id_fkey" FOREIGN KEY ("source_submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_source_document_version_id_fkey" FOREIGN KEY ("source_document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "structured_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requirement_instance_id_fkey" FOREIGN KEY ("requirement_instance_id") REFERENCES "requirement_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_requirement_instance_id_fkey" FOREIGN KEY ("requirement_instance_id") REFERENCES "requirement_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_organization_id_fkey" FOREIGN KEY ("author_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_requirement_instance_id_fkey" FOREIGN KEY ("requirement_instance_id") REFERENCES "requirement_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_organization_id_fkey" FOREIGN KEY ("assigned_to_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbr_reporting_periods" ADD CONSTRAINT "cbr_reporting_periods_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbr_reporting_periods" ADD CONSTRAINT "cbr_reporting_periods_prior_period_id_fkey" FOREIGN KEY ("prior_period_id") REFERENCES "cbr_reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbr_project_profiles" ADD CONSTRAINT "cbr_project_profiles_cbr_period_id_fkey" FOREIGN KEY ("cbr_period_id") REFERENCES "cbr_reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_records" ADD CONSTRAINT "job_records_cbr_period_id_fkey" FOREIGN KEY ("cbr_period_id") REFERENCES "cbr_reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_records" ADD CONSTRAINT "job_records_employer_party_id_fkey" FOREIGN KEY ("employer_party_id") REFERENCES "deal_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_records" ADD CONSTRAINT "job_records_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_records" ADD CONSTRAINT "benefit_records_cbr_period_id_fkey" FOREIGN KEY ("cbr_period_id") REFERENCES "cbr_reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_records" ADD CONSTRAINT "benefit_records_employer_party_id_fkey" FOREIGN KEY ("employer_party_id") REFERENCES "deal_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_occupants" ADD CONSTRAINT "tenant_occupants_cbr_period_id_fkey" FOREIGN KEY ("cbr_period_id") REFERENCES "cbr_reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_occupants" ADD CONSTRAINT "tenant_occupants_tenant_party_id_fkey" FOREIGN KEY ("tenant_party_id") REFERENCES "deal_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_outcomes" ADD CONSTRAINT "service_outcomes_cbr_period_id_fkey" FOREIGN KEY ("cbr_period_id") REFERENCES "cbr_reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_outcome_snapshots" ADD CONSTRAINT "shared_outcome_snapshots_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_outcome_snapshots" ADD CONSTRAINT "shared_outcome_snapshots_controlled_by_cde_participation_i_fkey" FOREIGN KEY ("controlled_by_cde_participation_id") REFERENCES "cde_participations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_outcome_snapshots" ADD CONSTRAINT "shared_outcome_snapshots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_outcome_values" ADD CONSTRAINT "shared_outcome_values_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "shared_outcome_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_outcome_values" ADD CONSTRAINT "shared_outcome_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cde_snapshot_approvals" ADD CONSTRAINT "cde_snapshot_approvals_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "shared_outcome_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cde_snapshot_approvals" ADD CONSTRAINT "cde_snapshot_approvals_cde_participation_id_fkey" FOREIGN KEY ("cde_participation_id") REFERENCES "cde_participations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cde_snapshot_approvals" ADD CONSTRAINT "cde_snapshot_approvals_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amis_field_mappings" ADD CONSTRAINT "amis_field_mappings_mapping_version_id_fkey" FOREIGN KEY ("mapping_version_id") REFERENCES "amis_mapping_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amis_field_mappings" ADD CONSTRAINT "amis_field_mappings_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "field_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_cde_participation_id_fkey" FOREIGN KEY ("cde_participation_id") REFERENCES "cde_participations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_mapping_version_id_fkey" FOREIGN KEY ("mapping_version_id") REFERENCES "amis_mapping_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_field_lineage" ADD CONSTRAINT "export_field_lineage_export_batch_id_fkey" FOREIGN KEY ("export_batch_id") REFERENCES "export_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_field_lineage" ADD CONSTRAINT "export_field_lineage_amis_field_mapping_id_fkey" FOREIGN KEY ("amis_field_mapping_id") REFERENCES "amis_field_mappings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_field_lineage" ADD CONSTRAINT "export_field_lineage_source_structured_value_id_fkey" FOREIGN KEY ("source_structured_value_id") REFERENCES "structured_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_field_lineage" ADD CONSTRAINT "export_field_lineage_source_snapshot_value_id_fkey" FOREIGN KEY ("source_snapshot_value_id") REFERENCES "shared_outcome_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_field_lineage" ADD CONSTRAINT "export_field_lineage_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_field_lineage" ADD CONSTRAINT "export_field_lineage_source_review_id_fkey" FOREIGN KEY ("source_review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_requirement_instance_id_fkey" FOREIGN KEY ("requirement_instance_id") REFERENCES "requirement_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_organization_id_fkey" FOREIGN KEY ("actor_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
