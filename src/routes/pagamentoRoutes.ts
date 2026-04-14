import { Router } from 'express';
import { PagamentoController } from '../controllers/PagamentoController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';
import { upload } from '../middlewares/upload';

const router = Router();
const pagamentoController = new PagamentoController();

// Autenticação obrigatória em todas as rotas
router.use(authMiddleware);

// Leitura: admin, contabilidade e operador
router.get('/', requireRole('admin', 'contabilidade', 'operador'), (req, res) => pagamentoController.listar(req, res));
router.get('/:id', requireRole('admin', 'contabilidade', 'operador'), (req, res) => pagamentoController.obterPorId(req, res));

// Criação/edição: admin e contabilidade
router.post('/', requireRole('admin', 'contabilidade'), (req, res) => pagamentoController.criar(req, res));
router.put('/:id', requireRole('admin', 'contabilidade'), (req, res) => pagamentoController.atualizar(req, res));

// Exclusão: somente admin
router.delete('/:id', requireRole('admin'), (req, res) => pagamentoController.deletar(req, res));

// Upload de comprovante: admin e contabilidade
router.post('/:id/comprovante', requireRole('admin', 'contabilidade'), upload.single('file'), (req, res) =>
  pagamentoController.uploadComprovante(req, res)
);

export default router;
