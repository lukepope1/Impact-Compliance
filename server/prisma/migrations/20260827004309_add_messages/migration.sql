-- CreateEnum
CREATE TYPE "MessageVisibility" AS ENUM ('qalicb_shared', 'deal_shared', 'cde_private');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('open', 'returned', 'closed');

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "parent_message_id" TEXT,
    "requirement_instance_id" TEXT,
    "from_user_id" TEXT NOT NULL,
    "from_organization_id" TEXT NOT NULL,
    "visibility" "MessageVisibility" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "due_date" DATE,
    "sla_days" INTEGER,
    "status" "MessageStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_deal_id_parent_message_id_created_at_idx" ON "messages"("deal_id", "parent_message_id", "created_at");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_requirement_instance_id_fkey" FOREIGN KEY ("requirement_instance_id") REFERENCES "requirement_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
