"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const FazendaController_1 = require("../controllers/FazendaController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const fazendaController = new FazendaController_1.FazendaController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => fazendaController.listar(req, res));
router.get('/:id', (req, res) => fazendaController.obterPorId(req, res));
router.post('/', (req, res) => fazendaController.criar(req, res));
router.post('/:id/incrementar-volume', (req, res) => fazendaController.incrementarVolume(req, res));
router.put('/:id', (req, res) => fazendaController.atualizar(req, res));
router.delete('/:id', (req, res) => fazendaController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=fazendaRoutes.js.map