import prisma from './src/services/prisma';

async function test() {
  const email = 'e.ali@apajh.asso.fr';
  console.log('Testing query for:', email);
  try {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null }
    });
    console.log('User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('User ID:', user.id);
      console.log('Password Hash:', user.passwordHash ? 'SET' : 'MISSING');
    }
  } catch (error: any) {
    console.error('Prisma Error:', error);
    if (error.cause) console.error('Error Cause:', error.cause);
    if (error.meta) console.error('Error Meta:', error.meta);
  } finally {
    await prisma.$disconnect();
  }
}

test();
