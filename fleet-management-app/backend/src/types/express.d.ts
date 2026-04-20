import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: Role;
        department?: string | null;
        userPoles?: { poleId: string; pole: { id: string; name: string } }[];
        userServices?: { serviceId: string; service: { id: string; name: string } }[];
      };
    }
  }
}
