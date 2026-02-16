"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const router = (0, express_1.Router)();
const authController = new controllers_1.AuthController();
router.post('/login', (req, res) => authController.login(req, res));
router.post('/registrar', (req, res) => authController.registrar(req, res));
exports.default = router;
//# sourceMappingURL=authRoutes.js.map