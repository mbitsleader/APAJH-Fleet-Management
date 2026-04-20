import { Router } from 'express';
import { 
  getAllUsers, 
  getOrCreateUserByEmail, 
  createUser, 
  deleteUser, 
  updateUserPassword, 
  updateUserAssignments,
  getMe,
  refreshTokenEndpoint,
  logoutUser,
  exportUserData
} from '../controllers/userController';
import { loginLimiter } from '../middleware/rateLimiter';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();


// Public — no auth needed
router.post('/login', loginLimiter, getOrCreateUserByEmail);
router.post('/refresh', refreshTokenEndpoint);
router.post('/logout', logoutUser);

// Protected — require auth
router.get('/me', authenticate, getMe);
router.get('/export', authenticate, exportUserData);
router.get('/', authenticate, getAllUsers);
router.post('/', authenticate, requirePermission('manageUsers'), createUser);
router.patch('/:id/password', authenticate, updateUserPassword);
router.patch('/:id/assignments', authenticate, requirePermission('manageUsers'), updateUserAssignments);
router.delete('/:id', authenticate, requirePermission('deleteUser'), deleteUser);

export default router;
