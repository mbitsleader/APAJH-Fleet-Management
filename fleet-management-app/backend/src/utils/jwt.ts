import jwt from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET as string;

if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is required');

interface JwtPayload {
  userId: string;
  role: string;
}

// Générer un access token (courte durée : 8h)
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  } as jwt.SignOptions);
}

// Générer un refresh token (longue durée : 7 jours)
export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

// Vérifier et décoder un access token
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// Vérifier et décoder un refresh token
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}
