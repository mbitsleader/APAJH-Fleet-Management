import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const SALT_ROUNDS = 12;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
  const email = 'admin@apajh.org';
  const name = 'Administrateur';
  const newPassword = 'Admin123!';
  
  console.log(`Creating admin account for ${email}...`);
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN' },
    create: {
      entraId: `local-admin-${Date.now()}`,
      email,
      name,
      role: 'ADMIN',
      passwordHash,
    }
  });
  
  console.log(`Successfully created/updated admin account: ${user.email}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
