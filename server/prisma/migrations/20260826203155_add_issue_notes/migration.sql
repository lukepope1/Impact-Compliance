-- CreateEnum
CREATE TYPE "IssueNoteVisibility" AS ENUM ('org_private', 'deal_shared');

-- CreateTable
CREATE TABLE "issue_notes" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "author_organization_id" TEXT NOT NULL,
    "visibility" "IssueNoteVisibility" NOT NULL DEFAULT 'org_private',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_notes_issue_id_created_at_idx" ON "issue_notes"("issue_id", "created_at");

-- AddForeignKey
ALTER TABLE "issue_notes" ADD CONSTRAINT "issue_notes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_notes" ADD CONSTRAINT "issue_notes_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_notes" ADD CONSTRAINT "issue_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_notes" ADD CONSTRAINT "issue_notes_author_organization_id_fkey" FOREIGN KEY ("author_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
