import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting data migration...');

  // 1. Update all VIEWERs to MEMBERs
  // Since we added MANAGER, VIEWER is still in the schema/enum (not yet removed)
  const updateResult = await prisma.projectMember.updateMany({
    where: {
      role: 'VIEWER' as any,
    },
    data: {
      role: 'MEMBER',
    },
  });

  console.log(`Updated ${updateResult.count} project members from VIEWER to MEMBER.`);

  // 2. Verification query: Make sure no project is left without at least one ADMIN
  const projects = await prisma.project.findMany({
    include: {
      members: {
        select: {
          role: true,
        },
      },
    },
  });

  console.log(`Verifying ${projects.length} projects...`);
  let invalidProjectsCount = 0;
  for (const project of projects) {
    const adminCount = project.members.filter((m) => m.role === 'ADMIN').length;
    if (adminCount === 0) {
      console.error(`ERROR: Project "${project.name}" (ID: ${project.id}) has NO ADMIN!`);
      invalidProjectsCount++;
    }
  }

  if (invalidProjectsCount > 0) {
    throw new Error(`Migration verification failed: ${invalidProjectsCount} project(s) have no ADMIN.`);
  }

  console.log('Verification successful! Every project has at least one ADMIN.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
