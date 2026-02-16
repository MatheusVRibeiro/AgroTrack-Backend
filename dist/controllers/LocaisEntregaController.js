"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocaisEntregaController = void 0;
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const LOCAL_FIELDS = ['nome', 'cidade', 'estado', 'ativo'];
class LocaisEntregaController {
    async listar(_req, res) {
        try {
            const [rows] = await connection_1.default.execute('SELECT * FROM locais_entrega ORDER BY created_at DESC');
            res.json({
                success: true,
                message: 'Locais de entrega listados com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao listar locais de entrega',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute('SELECT * FROM locais_entrega WHERE id = ? LIMIT 1', [id]);
            const locais = rows;
            if (locais.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Local de entrega nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Local de entrega carregado com sucesso',
                data: locais[0],
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao obter local de entrega',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarLocalEntregaSchema.parse(req.body);
            const id = payload.id || (0, crypto_1.randomUUID)();
            const ativo = payload.ativo !== undefined ? payload.ativo : true;
            await connection_1.default.execute('INSERT INTO locais_entrega (id, nome, cidade, estado, ativo) VALUES (?, ?, ?, ?, ?)', [id, payload.nome, payload.cidade, payload.estado, ativo]);
            res.status(201).json({
                success: true,
                message: 'Local de entrega criado com sucesso',
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
                message: 'Erro ao criar local de entrega',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarLocalEntregaSchema.parse(req.body);
            const { fields, values } = (0, sql_1.buildUpdate)(payload, LOCAL_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE locais_entrega SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Local de entrega nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Local de entrega atualizado com sucesso',
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
                message: 'Erro ao atualizar local de entrega',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM locais_entrega WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Local de entrega nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Local de entrega removido com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover local de entrega',
            });
        }
    }
}
exports.LocaisEntregaController = LocaisEntregaController;
//# sourceMappingURL=LocaisEntregaController.js.map