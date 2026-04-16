import { Router } from 'express';
import { AuthController } from '../controllers';
import { loginLimiter, defaultLimiter } from '../middlewares/rateLimiter';

import { authMiddleware } from '../middlewares/auth';

const router = Router();
const authController = new AuthController();

// Verifica identidade (Who Am I) — Aceita cookie HttpOnly
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));

// Aplica rate limiter especificamente na rota de login
router.post('/login', loginLimiter, (req, res) => authController.login(req, res));
router.post('/registrar', defaultLimiter, (req, res) => authController.registrar(req, res));

// Refresh token (aceita cookie HttpOnly ou body)
router.post('/refresh', defaultLimiter, (req, res) => authController.refreshToken(req, res));

// Logout (limpa cookies HttpOnly)
router.post('/logout', (req, res) => authController.logout(req, res));

// Rotas de recuperação de senha (rate limited para evitar spam)
router.post('/recuperar-senha', defaultLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/redefinir-senha', defaultLimiter, (req, res) => authController.resetPassword(req, res));

// Aliases em inglês para compatibilidade (deprecated)
router.post('/forgot-password', defaultLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', defaultLimiter, (req, res) => authController.resetPassword(req, res));

export default router;
