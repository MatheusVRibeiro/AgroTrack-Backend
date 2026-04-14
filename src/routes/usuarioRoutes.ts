import { Router } from 'express';
import { UsuarioController } from '../controllers/UsuarioController';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/authorize';

const router = Router();
const usuarioController = new UsuarioController();

router.use(authMiddleware);

// Gerenciamento de usuários: somente admin
router.get('/', requireRole('admin'), (req, res) => usuarioController.listar(req, res));
router.get('/:id', requireRole('admin'), (req, res) => usuarioController.obterPorId(req, res));
router.post('/', requireRole('admin'), (req, res) => usuarioController.criar(req, res));
router.put('/:id', requireRole('admin'), (req, res) => usuarioController.atualizar(req, res));
router.delete('/:id', requireRole('admin'), (req, res) => usuarioController.deletar(req, res));

export default router;
