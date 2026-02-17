import { Router } from 'express';
import { FreteController } from '../controllers/FreteController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
const freteController = new FreteController();

router.use(authMiddleware);

router.get('/', (req, res) => freteController.listar(req, res));
router.get('/pendentes', (req, res) => freteController.pendentes(req, res));
router.get('/:id', (req, res) => freteController.obterPorId(req, res));
router.post('/', (req, res) => freteController.criar(req, res));
router.put('/:id', (req, res) => freteController.atualizar(req, res));
router.delete('/:id', (req, res) => freteController.deletar(req, res));

export default router;
