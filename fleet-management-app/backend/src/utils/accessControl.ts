import { VehicleType } from '@prisma/client';
import { canViewAllVehicles } from './permissions';

export function buildVehicleAccessFilter(user: any) {
  if (canViewAllVehicles(user.role)) {
    return {};
  }

  const poleIds = user.userPoles?.map((p: any) => p.poleId) || [];
  const serviceIds = user.userServices?.map((s: any) => s.serviceId) || [];

  if (user.role === 'PROFESSIONNEL') {
    return {
      OR: [
        { assignedUserId: user.id },
        { 
          AND: [
            { serviceId: { in: serviceIds } },
            { type: VehicleType.REPLACEMENT }
          ]
        }
      ],
    };
  }

  return {
    OR: [
      { assignedUserId: user.id },
      { serviceId: { in: serviceIds } },
      { service: { poleId: { in: poleIds } } },
    ],
  };
}
