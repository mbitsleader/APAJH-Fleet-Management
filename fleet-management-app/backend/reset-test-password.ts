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
  const email = 'test.user@apajh.org';
  const newPassword = 'Admin123!';
  
  console.log(`Resetting password for ${email}...`);
  
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash }
  });
  
  console.log(`Successfully updated password for ${user.email}`);
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
