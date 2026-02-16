"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const LocaisEntregaController_1 = require("../controllers/LocaisEntregaController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const locaisEntregaController = new LocaisEntregaController_1.LocaisEntregaController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => locaisEntregaController.listar(req, res));
router.get('/:id', (req, res) => locaisEntregaController.obterPorId(req, res));
router.post('/', (req, res) => locaisEntregaController.criar(req, res));
router.put('/:id', (req, res) => locaisEntregaController.atualizar(req, res));
router.delete('/:id', (req, res) => locaisEntregaController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=locaisEntregaRoutes.js.map