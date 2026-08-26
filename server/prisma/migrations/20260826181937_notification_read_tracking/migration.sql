-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);
