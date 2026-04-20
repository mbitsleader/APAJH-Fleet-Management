import { buildVehicleAccessFilter } from '../src/utils/accessControl';

describe('buildVehicleAccessFilter', () => {
  const mockUserBase = {
    id: 'user-1',
    userPoles: [{ poleId: 'pole-1' }],
    userServices: [{ serviceId: 'service-1' }],
  };

  it('should return empty filter for ADMIN', () => {
    const user = { ...mockUserBase, role: 'ADMIN' };
    expect(buildVehicleAccessFilter(user)).toEqual({});
  });

  it('should return empty filter for DIRECTEUR', () => {
    const user = { ...mockUserBase, role: 'DIRECTEUR' };
    expect(buildVehicleAccessFilter(user)).toEqual({});
  });

  it('should return default filter for MANAGER', () => {
    const user = { ...mockUserBase, role: 'MANAGER' };
    expect(buildVehicleAccessFilter(user)).toEqual({
      OR: [
        { assignedUserId: 'user-1' },
        { serviceId: { in: ['service-1'] } },
        { service: { poleId: { in: ['pole-1'] } } },
      ],
    });
  });

  it('should return restricted filter for PROFESSIONNEL', () => {
    const user = { ...mockUserBase, role: 'PROFESSIONNEL' };
    // Current behavior (this will fail once I change the expectation to the new logic)
    // New expected behavior:
    expect(buildVehicleAccessFilter(user)).toEqual({
      OR: [
        { assignedUserId: 'user-1' },
        { 
          AND: [
            { serviceId: { in: ['service-1'] } },
            { type: 'REPLACEMENT' }
          ]
        }
      ],
    });
  });
});
