import { Router } from 'express';
import { CustoController } from '../controllers/CustoController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';

const router = Router();
const custoController = new CustoController();

router.use(authMiddleware);

// Leitura: admin, contabilidade e operador
router.get('/', requireRole('admin', 'contabilidade', 'operador'), (req, res) => custoController.listar(req, res));
router.get('/:id', requireRole('admin', 'contabilidade', 'operador'), (req, res) => custoController.obterPorId(req, res));

// Criação/edição: admin e operador
router.post('/', requireRole('admin', 'operador'), (req, res) => custoController.criar(req, res));
router.put('/:id', requireRole('admin', 'operador'), (req, res) => custoController.atualizar(req, res));

// Exclusão: somente admin
router.delete('/:id', requireRole('admin'), (req, res) => custoController.deletar(req, res));

export default router;
