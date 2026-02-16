"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DashboardController_1 = require("../controllers/DashboardController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const dashboardController = new DashboardController_1.DashboardController();
router.use(auth_1.authMiddleware);
router.get('/kpis', (req, res) => dashboardController.obterKPIs(req, res));
router.get('/estatisticas-rotas', (req, res) => dashboardController.obterEstatisticasPorRota(req, res));
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map