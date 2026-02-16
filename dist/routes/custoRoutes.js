"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CustoController_1 = require("../controllers/CustoController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const custoController = new CustoController_1.CustoController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => custoController.listar(req, res));
router.get('/:id', (req, res) => custoController.obterPorId(req, res));
router.post('/', (req, res) => custoController.criar(req, res));
router.put('/:id', (req, res) => custoController.atualizar(req, res));
router.delete('/:id', (req, res) => custoController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=custoRoutes.js.map