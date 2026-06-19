-- AlterTable
ALTER TYPE "ProjectRole" RENAME TO "ProjectRole_old";
CREATE TYPE "ProjectRole" AS ENUM ('ADMIN', 'MEMBER', 'MANAGER');
ALTER TABLE "project_members" ALTER COLUMN "role" TYPE "ProjectRole" USING ("role"::text::"ProjectRole");
DROP TYPE "ProjectRole_old";
