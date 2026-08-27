-- CreateEnum
CREATE TYPE "ImpactMetric" AS ENUM ('permanent_jobs', 'retained_jobs', 'construction_jobs', 'lmi_jobs', 'people_served', 'square_feet');

-- CreateTable
CREATE TABLE "impact_targets" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "metric" "ImpactMetric" NOT NULL,
    "committed_value" DECIMAL(18,2) NOT NULL,
    "source_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "impact_targets_deal_id_metric_key" ON "impact_targets"("deal_id", "metric");

-- AddForeignKey
ALTER TABLE "impact_targets" ADD CONSTRAINT "impact_targets_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
