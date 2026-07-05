-- AlterTable
ALTER TABLE "Robot" ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Compilation" ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 1;
