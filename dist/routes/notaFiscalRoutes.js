"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const NotaFiscalController_1 = require("../controllers/NotaFiscalController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const notaFiscalController = new NotaFiscalController_1.NotaFiscalController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => notaFiscalController.listar(req, res));
router.get('/:id', (req, res) => notaFiscalController.obterPorId(req, res));
router.post('/', (req, res) => notaFiscalController.criar(req, res));
router.put('/:id', (req, res) => notaFiscalController.atualizar(req, res));
router.delete('/:id', (req, res) => notaFiscalController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=notaFiscalRoutes.js.map