-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedFields" JSONB;
