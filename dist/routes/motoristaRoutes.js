"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MotoristaController_1 = require("../controllers/MotoristaController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const motoristaController = new MotoristaController_1.MotoristaController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => motoristaController.listar(req, res));
router.get('/:id', (req, res) => motoristaController.obterPorId(req, res));
router.post('/', (req, res) => motoristaController.criar(req, res));
router.put('/:id', (req, res) => motoristaController.atualizar(req, res));
router.delete('/:id', (req, res) => motoristaController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=motoristaRoutes.js.map