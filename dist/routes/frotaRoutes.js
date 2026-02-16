"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const FrotaController_1 = require("../controllers/FrotaController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const frotaController = new FrotaController_1.FrotaController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => frotaController.listar(req, res));
router.get('/:id', (req, res) => frotaController.obterPorId(req, res));
router.post('/', (req, res) => frotaController.criar(req, res));
router.put('/:id', (req, res) => frotaController.atualizar(req, res));
router.delete('/:id', (req, res) => frotaController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=frotaRoutes.js.map