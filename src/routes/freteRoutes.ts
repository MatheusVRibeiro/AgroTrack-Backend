import { Router } from 'express';
import { FreteController } from '../controllers/FreteController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';

const router = Router();
const freteController = new FreteController();

router.use(authMiddleware);

// Leitura: admin, contabilidade e operador
router.get('/', requireRole('admin', 'contabilidade', 'operador'), (req, res) => freteController.listar(req, res));
router.get('/estatisticas', requireRole('admin', 'contabilidade', 'operador'), (req, res) => freteController.estatisticas(req, res));
router.get('/pendentes', requireRole('admin', 'contabilidade', 'operador'), (req, res) => freteController.pendentes(req, res));
router.get('/:id', requireRole('admin', 'contabilidade', 'operador'), (req, res) => freteController.obterPorId(req, res));

// Criação/edição: admin e operador
router.post('/', requireRole('admin', 'operador'), (req, res) => freteController.criar(req, res));
router.put('/:id', requireRole('admin', 'operador'), (req, res) => freteController.atualizar(req, res));

// Exclusão: somente admin
router.delete('/:id', requireRole('admin'), (req, res) => freteController.deletar(req, res));

export default router;
