"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const UsuarioController_1 = require("../controllers/UsuarioController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const usuarioController = new UsuarioController_1.UsuarioController();
router.use(auth_1.authMiddleware);
router.get('/', (req, res) => usuarioController.listar(req, res));
router.get('/:id', (req, res) => usuarioController.obterPorId(req, res));
router.post('/', (req, res) => usuarioController.criar(req, res));
router.put('/:id', (req, res) => usuarioController.atualizar(req, res));
router.delete('/:id', (req, res) => usuarioController.deletar(req, res));
exports.default = router;
//# sourceMappingURL=usuarioRoutes.js.map