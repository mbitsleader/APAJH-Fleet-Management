import request from 'supertest';
import app from '../src/app';
import prisma from '../src/services/prisma';
import bcrypt from 'bcrypt';

describe('Authentication API', () => {
  const testUser = {
    email: 'test.auth@apajh.org',
    password: 'Password@123!',
    name: 'Test Auth User'
  };

  beforeAll(async () => {
    // Cleanup and create test user
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    const passwordHash = await bcrypt.hash(testUser.password, 12);
    await prisma.user.create({
      data: {
        email: testUser.email,
        name: testUser.name,
        passwordHash,
        role: 'PROFESSIONNEL',
        entraId: 'test-auth-id'
      }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
  });

  it('should login successfully with correct credentials', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('email', testUser.email);
    expect(response.headers['set-cookie']).toBeDefined();
    
    // Check for access_token cookie
    const cookies = response.headers['set-cookie'];
    const hasAccessToken = Array.isArray(cookies) 
      ? cookies.some((c: string) => c.includes('access_token'))
      : typeof cookies === 'string' && cookies.includes('access_token');
      
    expect(hasAccessToken).toBe(true);
  });

  it('should fail login with wrong password', async () => {
    const response = await request(app)
      .post('/api/users/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123!'
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Email ou mot de passe incorrect.');
  });
});
