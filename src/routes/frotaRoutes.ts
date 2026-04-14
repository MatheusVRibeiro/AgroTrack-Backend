import { Router } from 'express';
import { FrotaController } from '../controllers/FrotaController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';

const router = Router();
const frotaController = new FrotaController();

router.use(authMiddleware);

// Leitura: admin, contabilidade e operador
router.get('/', requireRole('admin', 'contabilidade', 'operador'), (req, res) => frotaController.listar(req, res));
router.get('/:id', requireRole('admin', 'contabilidade', 'operador'), (req, res) => frotaController.obterPorId(req, res));

// Criação/edição: admin e operador
router.post('/', requireRole('admin', 'operador'), (req, res) => frotaController.criar(req, res));
router.put('/:id', requireRole('admin', 'operador'), (req, res) => frotaController.atualizar(req, res));

// Exclusão: somente admin
router.delete('/:id', requireRole('admin'), (req, res) => frotaController.deletar(req, res));

export default router;
