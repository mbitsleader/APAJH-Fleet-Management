require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { email: 'manager.enfance@apajh.re' },
    include: {
      userPoles: { include: { pole: true } }
    }
  });

  console.log('User:', user.email);
  console.log('Role:', user.role);
  console.log('Poles:', user.userPoles.map(up => up.pole.name));

  const allVehicles = await prisma.vehicle.count();
  console.log('Total vehicles in DB:', allVehicles);

  const enfanceVehicles = await prisma.vehicle.count({
    where: { service: { pole: { name: 'Enfance' } } }
  });
  console.log('Enfance vehicles in DB:', enfanceVehicles);

  const adulteVehicles = await prisma.vehicle.count({
    where: { service: { pole: { name: 'Adulte' } } }
  });
  console.log('Adulte vehicles in DB:', adulteVehicles);
  
  await prisma.$disconnect();
}

checkUser();
