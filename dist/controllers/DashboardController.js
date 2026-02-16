"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const connection_1 = __importDefault(require("../database/connection"));
class DashboardController {
    async obterKPIs(_req, res) {
        try {
            const [freteRows] = await connection_1.default.execute(`SELECT 
          COALESCE(SUM(receita), 0) AS receita_total,
          COALESCE(SUM(custos), 0) AS custos_total,
          COALESCE(SUM(receita - custos), 0) AS lucro_total,
          COUNT(*) AS total_fretes
        FROM fretes`);
            const [motoristaRows] = await connection_1.default.execute("SELECT COUNT(*) AS motoristas_ativos FROM motoristas WHERE status = 'ativo'");
            const [frotaRows] = await connection_1.default.execute("SELECT COUNT(*) AS caminhoes_disponiveis FROM Frota WHERE status = 'disponivel'");
            const frete = freteRows[0];
            const motoristas = motoristaRows[0];
            const frota = frotaRows[0];
            const margemLucro = frete.receita_total > 0
                ? Number(((frete.lucro_total / frete.receita_total) * 100).toFixed(2))
                : 0;
            res.json({
                success: true,
                message: 'KPIs carregados com sucesso',
                data: {
                    receitaTotal: frete.receita_total,
                    custosTotal: frete.custos_total,
                    lucroTotal: frete.lucro_total,
                    margemLucro,
                    totalFretes: frete.total_fretes,
                    motoristasAtivos: motoristas.motoristas_ativos,
                    caminhoesDisponiveis: frota.caminhoes_disponiveis,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao carregar KPIs',
            });
        }
    }
    async obterEstatisticasPorRota(_req, res) {
        try {
            const [rows] = await connection_1.default.execute(`SELECT 
          origem,
          destino,
          COUNT(*) AS total_fretes,
          COALESCE(SUM(receita), 0) AS receita_total,
          COALESCE(SUM(custos), 0) AS custos_total,
          COALESCE(SUM(receita - custos), 0) AS lucro_total
        FROM fretes
        GROUP BY origem, destino
        ORDER BY lucro_total DESC`);
            res.json({
                success: true,
                message: 'Estatisticas por rota carregadas com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao carregar estatisticas por rota',
            });
        }
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=DashboardController.js.map