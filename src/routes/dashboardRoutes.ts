import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';

const router = Router();
const dashboardController = new DashboardController();

router.use(authMiddleware);

// Dashboard: admin, contabilidade e operador (excluir motoristas)
router.get('/kpis', requireRole('admin', 'contabilidade', 'operador'), (req, res) => dashboardController.obterKPIs(req, res));
router.get('/estatisticas-rotas', requireRole('admin', 'contabilidade', 'operador'), (req, res) => dashboardController.obterEstatisticasPorRota(req, res));

export default router;
