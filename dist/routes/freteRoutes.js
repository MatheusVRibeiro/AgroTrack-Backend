"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const FreteController_1 = require("../controllers/FreteController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const freteController = new FreteController_1.FreteController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => freteController.listar(req, res));
router.get('/:id', (req, res) => freteController.obterPorId(req, res));
router.post('/', (req, res) => freteController.criar(req, res));
router.put('/:id', (req, res) => freteController.atualizar(req, res));
router.delete('/:id', (req, res) => freteController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=freteRoutes.js.map