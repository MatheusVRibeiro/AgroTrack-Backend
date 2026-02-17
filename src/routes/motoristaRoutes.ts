import { Router } from 'express';
import { MotoristaController } from '../controllers/MotoristaController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
const motoristaController = MotoristaController;

router.use(authMiddleware);

router.get('/', (req, res) => motoristaController.listar(req, res));
router.get('/:id', (req, res) => motoristaController.obterPorId(req, res));
router.post('/', (req, res) => motoristaController.criar(req, res));
router.put('/:id', (req, res) => motoristaController.atualizar(req, res));
router.delete('/:id', (req, res) => motoristaController.deletar(req, res));

export default router;
