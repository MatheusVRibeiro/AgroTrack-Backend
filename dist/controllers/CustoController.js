"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustoController = void 0;
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const id_1 = require("../utils/id");
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const CUSTO_FIELDS = [
    'frete_id',
    'tipo',
    'descricao',
    'valor',
    'data',
    'comprovante',
    'observacoes',
    'motorista',
    'caminhao',
    'rota',
    'litros',
    'tipo_combustivel',
];
class CustoController {
    async listar(_req, res) {
        try {
            const [rows] = await connection_1.default.execute('SELECT * FROM custos ORDER BY created_at DESC');
            res.json({
                success: true,
                message: 'Custos listados com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao listar custos',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute('SELECT * FROM custos WHERE id = ? LIMIT 1', [id]);
            const custos = rows;
            if (custos.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Custo nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Custo carregado com sucesso',
                data: custos[0],
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao obter custo',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarCustoSchema.parse(req.body);
            const id = payload.id || (0, id_1.generateId)('CUSTO');
            const connection = await connection_1.default.getConnection();
            try {
                await connection.beginTransaction();
                const [freteRows] = await connection.execute('SELECT id FROM fretes WHERE id = ? LIMIT 1', [
                    payload.frete_id,
                ]);
                const fretes = freteRows;
                if (fretes.length === 0) {
                    await connection.rollback();
                    res.status(404).json({
                        success: false,
                        message: 'Frete nao encontrado',
                    });
                    return;
                }
                await connection.execute(`INSERT INTO custos (
            id, frete_id, tipo, descricao, valor, data, comprovante,
            observacoes, motorista, caminhao, rota, litros, tipo_combustivel
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    id,
                    payload.frete_id,
                    payload.tipo,
                    payload.descricao,
                    payload.valor,
                    payload.data,
                    payload.comprovante || false,
                    payload.observacoes || null,
                    payload.motorista || null,
                    payload.caminhao || null,
                    payload.rota || null,
                    payload.litros || null,
                    payload.tipo_combustivel || null,
                ]);
                await connection.execute(`UPDATE fretes
           SET custos = IFNULL(custos, 0) + ?,
               resultado = IFNULL(receita, 0) - (IFNULL(custos, 0) + ?)
           WHERE id = ?`, [payload.valor, payload.valor, payload.frete_id]);
                await connection.commit();
            }
            catch (transactionError) {
                await connection.rollback();
                throw transactionError;
            }
            finally {
                connection.release();
            }
            res.status(201).json({
                success: true,
                message: 'Custo criado com sucesso',
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
                message: 'Erro ao criar custo',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarCustoSchema.parse(req.body);
            const { fields, values } = (0, sql_1.buildUpdate)(payload, CUSTO_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE custos SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Custo nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Custo atualizado com sucesso',
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
                message: 'Erro ao atualizar custo',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM custos WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Custo nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Custo removido com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover custo',
            });
        }
    }
}
exports.CustoController = CustoController;
//# sourceMappingURL=CustoController.js.map