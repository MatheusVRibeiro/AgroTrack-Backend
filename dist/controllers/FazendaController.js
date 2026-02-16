"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FazendaController = void 0;
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const id_1 = require("../utils/id");
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const FAZENDA_FIELDS = [
    'fazenda',
    'localizacao',
    'proprietario',
    'mercadoria',
    'variedade',
    'safra',
    'preco_por_tonelada',
    'peso_medio_saca',
    'total_sacas_carregadas',
    'total_toneladas',
    'faturamento_total',
    'ultimo_frete',
    'colheita_finalizada',
];
class FazendaController {
    async listar(_req, res) {
        try {
            const [rows] = await connection_1.default.execute(`
        SELECT 
          f.*,
          (SELECT COUNT(*) FROM fretes fr WHERE fr.fazenda_id = f.id) as total_fretes_realizados,
          (SELECT COALESCE(SUM(c.valor), 0) FROM custos c
           INNER JOIN fretes fr ON c.frete_id = fr.id
           WHERE fr.fazenda_id = f.id) as total_custos_operacionais,
          (f.faturamento_total - 
           COALESCE((SELECT SUM(c.valor) FROM custos c 
                     INNER JOIN fretes fr ON c.frete_id = fr.id 
                     WHERE fr.fazenda_id = f.id), 0)
          ) as lucro_liquido,
          (SELECT id FROM fretes fr WHERE fr.fazenda_id = f.id 
           ORDER BY fr.data_frete DESC, fr.created_at DESC LIMIT 1) as ultimo_frete_id,
          (SELECT motorista_nome FROM fretes fr WHERE fr.fazenda_id = f.id 
           ORDER BY fr.data_frete DESC, fr.created_at DESC LIMIT 1) as ultimo_frete_motorista,
          (SELECT caminhao_placa FROM fretes fr WHERE fr.fazenda_id = f.id 
           ORDER BY fr.data_frete DESC, fr.created_at DESC LIMIT 1) as ultimo_frete_placa,
          (SELECT origem FROM fretes fr WHERE fr.fazenda_id = f.id 
           ORDER BY fr.data_frete DESC, fr.created_at DESC LIMIT 1) as ultimo_frete_origem,
          (SELECT destino FROM fretes fr WHERE fr.fazenda_id = f.id 
           ORDER BY fr.data_frete DESC, fr.created_at DESC LIMIT 1) as ultimo_frete_destino,
          (SELECT data_frete FROM fretes fr WHERE fr.fazenda_id = f.id 
           ORDER BY fr.data_frete DESC, fr.created_at DESC LIMIT 1) as ultimo_frete_data
        FROM fazendas f
        ORDER BY f.created_at DESC
      `);
            res.json({
                success: true,
                message: 'Fazendas listadas com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao listar fazendas',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute('SELECT * FROM fazendas WHERE id = ? LIMIT 1', [id]);
            const fazendas = rows;
            if (fazendas.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Fazenda nao encontrada',
                });
                return;
            }
            const fazenda = fazendas[0];
            // Buscar dados agregados em paralelo
            const [ultimoFreteRows, totalFretesRows, totalCustosRows] = await Promise.all([
                // Último frete desta fazenda
                connection_1.default.execute(`SELECT id, motorista_nome, caminhao_placa, origem, destino, data_frete
           FROM fretes
           WHERE fazenda_id = ?
           ORDER BY data_frete DESC, created_at DESC
           LIMIT 1`, [id]),
                // Total de fretes realizados
                connection_1.default.execute('SELECT COUNT(*) AS total FROM fretes WHERE fazenda_id = ?', [id]),
                // Total de custos operacionais (soma dos custos vinculados aos fretes dessa fazenda)
                connection_1.default.execute(`SELECT COALESCE(SUM(c.valor), 0) AS total
           FROM custos c
           INNER JOIN fretes f ON c.frete_id = f.id
           WHERE f.fazenda_id = ?`, [id]),
            ]);
            const ultimoFrete = ultimoFreteRows[0][0];
            const totalFretes = totalFretesRows[0][0]?.total ?? 0;
            const totalCustosOperacionais = totalCustosRows[0][0]?.total ?? 0;
            const faturamentoTotal = Number(fazenda.faturamento_total || 0);
            const custosOperacionais = Number(totalCustosOperacionais || 0);
            res.json({
                success: true,
                message: 'Fazenda carregada com sucesso',
                data: {
                    ...fazenda,
                    total_fretes_realizados: totalFretes,
                    total_custos_operacionais: custosOperacionais,
                    lucro_liquido: faturamentoTotal - custosOperacionais,
                    ultimo_frete_id: ultimoFrete?.id || null,
                    ultimo_frete_motorista: ultimoFrete?.motorista_nome || null,
                    ultimo_frete_placa: ultimoFrete?.caminhao_placa || null,
                    ultimo_frete_origem: ultimoFrete?.origem || null,
                    ultimo_frete_destino: ultimoFrete?.destino || null,
                    ultimo_frete_data: ultimoFrete?.data_frete || null,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao obter fazenda',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarFazendaSchema.parse(req.body);
            const id = payload.id || (0, id_1.generateId)('FAZ');
            const pesoMedioSaca = payload.peso_medio_saca !== undefined ? payload.peso_medio_saca : 25.0;
            const colheitaFinalizada = payload.colheita_finalizada !== undefined ? payload.colheita_finalizada : false;
            await connection_1.default.execute(`INSERT INTO fazendas (
          id, fazenda, localizacao, proprietario, mercadoria, variedade, safra,
          preco_por_tonelada, peso_medio_saca, total_sacas_carregadas, total_toneladas,
          faturamento_total, ultimo_frete, colheita_finalizada
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                payload.fazenda,
                payload.localizacao,
                payload.proprietario,
                payload.mercadoria,
                payload.variedade || null,
                payload.safra,
                payload.preco_por_tonelada,
                pesoMedioSaca,
                payload.total_sacas_carregadas || 0,
                payload.total_toneladas || 0,
                payload.faturamento_total || 0,
                payload.ultimo_frete || null,
                colheitaFinalizada,
            ]);
            res.status(201).json({
                success: true,
                message: 'Fazenda criada com sucesso',
                data: { id },
            });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    message: 'Dados invalidos',
                    error: error.errors.map((err) => err.message).join('; '),
                });
                return;
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao criar fazenda',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarFazendaSchema.parse(req.body);
            const { fields, values } = (0, sql_1.buildUpdate)(payload, FAZENDA_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE fazendas SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Fazenda nao encontrada',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Fazenda atualizada com sucesso',
            });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    message: 'Dados invalidos',
                    error: error.errors.map((err) => err.message).join('; '),
                });
                return;
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao atualizar fazenda',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM fazendas WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Fazenda nao encontrada',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Fazenda removida com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover fazenda',
            });
        }
    }
    async incrementarVolume(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.IncrementarVolumeSchema.parse(req.body);
            // Verificar se a fazenda existe
            const [rows] = await connection_1.default.execute('SELECT * FROM fazendas WHERE id = ? LIMIT 1', [id]);
            const fazendas = rows;
            if (fazendas.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Fazenda não encontrada',
                });
                return;
            }
            // Incrementar o volume transportado (total_toneladas)
            await connection_1.default.execute('UPDATE fazendas SET total_toneladas = total_toneladas + ? WHERE id = ?', [payload.toneladas, id]);
            // Buscar fazenda atualizada
            const [updatedRows] = await connection_1.default.execute('SELECT * FROM fazendas WHERE id = ? LIMIT 1', [id]);
            const fazendaAtualizada = updatedRows[0];
            res.json({
                success: true,
                message: 'Volume incrementado com sucesso',
                data: fazendaAtualizada,
            });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    message: 'Dados inválidos',
                    error: error.errors.map((err) => err.message).join('; '),
                });
                return;
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao incrementar volume',
            });
        }
    }
}
exports.FazendaController = FazendaController;
//# sourceMappingURL=FazendaController.js.map