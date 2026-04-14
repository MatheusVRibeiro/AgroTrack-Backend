import { Router } from 'express';
import { FazendaController } from '../controllers/FazendaController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';

const router = Router();
const fazendaController = new FazendaController();

router.use(authMiddleware);

// Leitura: admin, contabilidade e operador
router.get('/', requireRole('admin', 'contabilidade', 'operador'), (req, res) => fazendaController.listar(req, res));
router.get('/:id', requireRole('admin', 'contabilidade', 'operador'), (req, res) => fazendaController.obterPorId(req, res));

// Criação/edição: admin e operador
router.post('/', requireRole('admin', 'operador'), (req, res) => fazendaController.criar(req, res));
router.post('/:id/incrementar-volume', requireRole('admin', 'operador'), (req, res) => fazendaController.incrementarVolume(req, res));
router.put('/:id', requireRole('admin', 'operador'), (req, res) => fazendaController.atualizar(req, res));

// Exclusão: somente admin
router.delete('/:id', requireRole('admin'), (req, res) => fazendaController.deletar(req, res));

export default router;
