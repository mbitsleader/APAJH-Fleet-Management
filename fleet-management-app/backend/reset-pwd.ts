import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';
import bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter: adapter as any });

async function main() {
  const email = 'admin@apajh.org';
  const password = 'P@ssw0rd2026!';
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hashedPassword, role: 'ADMIN' },
    create: {
      email,
      name: 'Admin Principal',
      role: 'ADMIN',
      passwordHash: hashedPassword,
      department: 'Direction',
      entraId: 'admin-entra-id'
    }
  });

  console.log(`Utilisateur mis à jour : ${user.email} avec le mot de passe: ${password}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
