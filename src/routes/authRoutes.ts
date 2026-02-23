import { Router } from 'express';
import { AuthController } from '../controllers';
import { loginLimiter, defaultLimiter } from '../middlewares/rateLimiter';

const router = Router();
const authController = new AuthController();

// Aplica rate limiter especificamente na rota de login
router.post('/login', loginLimiter, (req, res) => authController.login(req, res));
router.post('/registrar', (req, res) => authController.registrar(req, res));

// Rotas de recuperação de senha (rate limited para evitar spam)
// Em português para consistência com a aplicação
router.post('/recuperar-senha', defaultLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/redefinir-senha', (req, res) => authController.resetPassword(req, res));

// Aliases em inglês para compatibilidade (deprecated)
router.post('/forgot-password', defaultLimiter, (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

export default router;
