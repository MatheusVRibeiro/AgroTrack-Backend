"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PagamentoController_1 = require("../controllers/PagamentoController");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const router = (0, express_1.Router)();
const pagamentoController = new PagamentoController_1.PagamentoController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => pagamentoController.listar(req, res));
router.get('/:id', (req, res) => pagamentoController.obterPorId(req, res));
router.post('/', (req, res) => pagamentoController.criar(req, res));
router.put('/:id', (req, res) => pagamentoController.atualizar(req, res));
router.delete('/:id', (req, res) => pagamentoController.deletar(req, res));
// Rota de upload de comprovante
router.post('/:id/comprovante', upload_1.upload.single('file'), (req, res) => pagamentoController.uploadComprovante(req, res));
exports.default = router;
//# sourceMappingURL=pagamentoRoutes.js.map