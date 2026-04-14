import { Router } from 'express';
import { MotoristaController } from '../controllers/MotoristaController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';

const router = Router();
const motoristaController = MotoristaController;

router.use(authMiddleware);

// Leitura: admin, contabilidade e operador
router.get('/', requireRole('admin', 'contabilidade', 'operador'), (req, res) => motoristaController.listar(req, res));
router.get('/:id', requireRole('admin', 'contabilidade', 'operador'), (req, res) => motoristaController.obterPorId(req, res));

// Criação/edição: admin e operador
router.post('/', requireRole('admin', 'operador'), (req, res) => motoristaController.criar(req, res));
router.put('/:id', requireRole('admin', 'operador'), (req, res) => motoristaController.atualizar(req, res));

// Exclusão: somente admin
router.delete('/:id', requireRole('admin'), (req, res) => motoristaController.deletar(req, res));

export default router;
