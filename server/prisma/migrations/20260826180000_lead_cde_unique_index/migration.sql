-- The canonical SQL schema (NMTC_Phase_1_Database_Schema.sql) enforces "one lead CDE per
-- deal" with a partial unique index, since Prisma's schema.prisma has no way to express a
-- filtered/partial unique constraint. Without this, the application-level check in
-- cdeParticipations.ts (find-then-create, not atomic) has a TOCTOU race: two concurrent
-- requests to add a lead CDE can both pass the check before either commits.
CREATE UNIQUE INDEX IF NOT EXISTS one_lead_cde_per_deal
  ON cde_participations (deal_id)
  WHERE is_lead_cde;
