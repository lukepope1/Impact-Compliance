-- AlterTable
ALTER TABLE "structured_values" ADD COLUMN     "qlici_id" TEXT;

-- CreateTable
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "qlici_id" TEXT NOT NULL,
    "qei_name" TEXT,
    "disbursement_date" DATE,
    "source_amount" DECIMAL(18,2),
    "is_revolving" BOOLEAN NOT NULL DEFAULT false,
    "amis_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disbursements_qlici_id_idx" ON "disbursements"("qlici_id");

-- CreateIndex
CREATE INDEX "structured_values_qlici_id_field_definition_id_reporting_pe_idx" ON "structured_values"("qlici_id", "field_definition_id", "reporting_period_end");

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_qlici_id_fkey" FOREIGN KEY ("qlici_id") REFERENCES "qlicis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_values" ADD CONSTRAINT "structured_values_qlici_id_fkey" FOREIGN KEY ("qlici_id") REFERENCES "qlicis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
