"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotoristaController = void 0;
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const id_1 = require("../utils/id");
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const MOTORISTA_FIELDS = [
    'nome',
    'cpf',
    'telefone',
    'email',
    'endereco',
    'cnh',
    'cnh_validade',
    'cnh_categoria',
    'status',
    'tipo',
    'data_admissao',
    'data_desligamento',
    'tipo_pagamento',
    'chave_pix_tipo',
    'chave_pix',
    'banco',
    'agencia',
    'conta',
    'tipo_conta',
    'receita_gerada',
    'viagens_realizadas',
    'caminhao_atual',
    'placa_temporaria',
];
class MotoristaController {
    async listar(_req, res) {
        try {
            const [rows] = await connection_1.default.execute('SELECT * FROM motoristas ORDER BY created_at DESC');
            res.json({
                success: true,
                message: 'Motoristas listados com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao listar motoristas',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute('SELECT * FROM motoristas WHERE id = ? LIMIT 1', [id]);
            const motoristas = rows;
            if (motoristas.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Motorista nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Motorista carregado com sucesso',
                data: motoristas[0],
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao obter motorista',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarMotoristaSchema.parse(req.body);
            // Higienização automática: Remove formatação antes de salvar
            const cpfLimpo = payload.cpf.replace(/\D/g, '');
            const cnhLimpa = payload.cnh.replace(/\D/g, '');
            const telefoneLimpo = payload.telefone.replace(/\D/g, '');
            const chavePixLimpa = payload.chave_pix ? payload.chave_pix.replace(/\D/g, '') : null;
            const rawPlaca = payload.placa_temporaria || null;
            const placaSanitizada = rawPlaca ? String(rawPlaca).toUpperCase().replace(/\s/g, '') : null;
            const id = payload.id || (0, id_1.generateId)('MOT');
            const status = payload.status || 'ativo';
            const tipoPagamento = payload.tipo_pagamento || 'pix';
            await connection_1.default.execute(`INSERT INTO motoristas (
          id, nome, cpf, telefone, email, endereco, cnh, cnh_validade,
          cnh_categoria, status, tipo, data_admissao, data_desligamento,
          tipo_pagamento, chave_pix_tipo, chave_pix, banco, agencia, conta,
          tipo_conta, receita_gerada, viagens_realizadas, caminhao_atual, placa_temporaria
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                payload.nome,
                cpfLimpo, // CPF sem formatação
                telefoneLimpo, // Telefone sem formatação
                payload.email,
                payload.endereco || null,
                cnhLimpa, // CNH sem formatação
                payload.cnh_validade,
                payload.cnh_categoria,
                status,
                payload.tipo,
                payload.data_admissao,
                payload.data_desligamento || null,
                tipoPagamento,
                payload.chave_pix_tipo || null,
                chavePixLimpa, // Chave PIX sem formatação
                payload.banco || null,
                payload.agencia || null,
                payload.conta || null,
                payload.tipo_conta || null,
                payload.receita_gerada || 0,
                payload.viagens_realizadas || 0,
                payload.caminhao_atual || null,
                // Regra: se for 'proprio' não persistimos placa_temporaria
                payload.tipo === 'terceirizado' ? placaSanitizada : null,
            ]);
            res.status(201).json({
                success: true,
                message: 'Motorista criado com sucesso',
                data: { id },
            });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    message: 'Dados inválidos. Verifique os campos preenchidos.',
                    error: error.errors.map((err) => err.message).join('; '),
                });
                return;
            }
            // Erro de CPF duplicado
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
                const message = String(error).includes('cpf')
                    ? 'Este CPF já está cadastrado no sistema.'
                    : String(error).includes('cnh')
                        ? 'Esta CNH já está cadastrada no sistema.'
                        : 'Dados duplicados. Verifique CPF ou CNH.';
                res.status(409).json({
                    success: false,
                    message,
                });
                return;
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao criar motorista. Tente novamente.',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarMotoristaSchema.parse(req.body);
            // Regra de negocio: se o tipo for definido como 'proprio', placa_temporaria sempre deve ser null
            if (payload.tipo === 'proprio') {
                payload.placa_temporaria = null;
            }
            else if (payload.placa_temporaria) {
                // Sanitiza placa antes de persistir
                payload.placa_temporaria = String(payload.placa_temporaria).toUpperCase().replace(/\s/g, '');
            }
            const { fields, values } = (0, sql_1.buildUpdate)(payload, MOTORISTA_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE motoristas SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Motorista nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Motorista atualizado com sucesso',
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
                message: 'Erro ao atualizar motorista',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM motoristas WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Motorista nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Motorista removido com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover motorista',
            });
        }
    }
}
exports.MotoristaController = MotoristaController;
//# sourceMappingURL=MotoristaController.js.map