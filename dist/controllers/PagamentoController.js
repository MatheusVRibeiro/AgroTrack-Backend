"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagamentoController = void 0;
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const id_1 = require("../utils/id");
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const PAGAMENTO_FIELDS = [
    'motorista_id',
    'motorista_nome',
    'periodo_fretes',
    'quantidade_fretes',
    'fretes_incluidos',
    'total_toneladas',
    'valor_por_tonelada',
    'valor_total',
    'data_pagamento',
    'status',
    'metodo_pagamento',
    'comprovante_nome',
    'comprovante_url',
    'comprovante_data_upload',
    'observacoes',
];
class PagamentoController {
    // Gerar próximo ID sequencial de pagamento (PAG-2026-001, PAG-2026-002...)
    async gerarProximoIdPagamento() {
        const anoAtual = new Date().getFullYear();
        const prefixo = `PAG-${anoAtual}-`;
        // Buscar o último pagamento do ano atual
        const [rows] = await connection_1.default.execute(`SELECT id FROM pagamentos WHERE id LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefixo}%`]);
        const pagamentos = rows;
        if (pagamentos.length === 0) {
            // Primeiro pagamento do ano
            return `${prefixo}001`;
        }
        // Extrair número sequencial do último ID (PAG-2026-001 -> 001)
        const ultimoId = pagamentos[0].id;
        const ultimoNumero = parseInt(ultimoId.split('-')[2], 10);
        const proximoNumero = ultimoNumero + 1;
        // Formatar com 3 dígitos (001, 002, ..., 999)
        return `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;
    }
    async listar(_req, res) {
        try {
            const [rows] = await connection_1.default.execute('SELECT * FROM pagamentos ORDER BY created_at DESC');
            res.json({
                success: true,
                message: 'Pagamentos listados com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao listar pagamentos',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute('SELECT * FROM pagamentos WHERE id = ? LIMIT 1', [id]);
            const pagamentos = rows;
            if (pagamentos.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Pagamento nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Pagamento carregado com sucesso',
                data: pagamentos[0],
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao obter pagamento',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarPagamentoSchema.parse(req.body);
            const id = payload.id || (await this.gerarProximoIdPagamento());
            const status = payload.status || 'pendente';
            await connection_1.default.execute(`INSERT INTO pagamentos (
          id, motorista_id, motorista_nome, periodo_fretes, quantidade_fretes, fretes_incluidos,
          total_toneladas, valor_por_tonelada, valor_total, data_pagamento, status, metodo_pagamento,
          comprovante_nome, comprovante_url, comprovante_data_upload, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                payload.motorista_id,
                payload.motorista_nome,
                payload.periodo_fretes,
                payload.quantidade_fretes,
                payload.fretes_incluidos || null,
                payload.total_toneladas,
                payload.valor_por_tonelada,
                payload.valor_total,
                payload.data_pagamento,
                status,
                payload.metodo_pagamento,
                payload.comprovante_nome || null,
                payload.comprovante_url || null,
                payload.comprovante_data_upload || null,
                payload.observacoes || null,
            ]);
            res.status(201).json({
                success: true,
                message: 'Pagamento criado com sucesso',
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
                message: 'Erro ao criar pagamento',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarPagamentoSchema.parse(req.body);
            const { fields, values } = (0, sql_1.buildUpdate)(payload, PAGAMENTO_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE pagamentos SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Pagamento nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Pagamento atualizado com sucesso',
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
                message: 'Erro ao atualizar pagamento',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM pagamentos WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Pagamento nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Pagamento removido com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover pagamento',
            });
        }
    }
    async uploadComprovante(req, res) {
        try {
            const { id } = req.params;
            // Verificar se o pagamento existe
            const [pagamentos] = await connection_1.default.execute('SELECT * FROM pagamentos WHERE id = ? LIMIT 1', [
                id,
            ]);
            const pagamentoArray = pagamentos;
            if (pagamentoArray.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Pagamento não encontrado',
                });
                return;
            }
            // Verificar se o arquivo foi enviado
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum arquivo foi enviado',
                });
                return;
            }
            const { filename, mimetype, size, originalname } = req.file;
            const anexoId = (0, id_1.generateId)('ANX');
            const fileUrl = `/uploads/${filename}`;
            // Inserir na tabela anexos
            await connection_1.default.execute(`INSERT INTO anexos (
          id, nome_original, nome_arquivo, url, tipo_mime, tamanho,
          entidade_tipo, entidade_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [anexoId, originalname, filename, fileUrl, mimetype, size, 'pagamento', id]);
            // Atualizar pagamento com dados do comprovante
            await connection_1.default.execute(`UPDATE pagamentos SET 
          comprovante_nome = ?,
          comprovante_url = ?,
          comprovante_data_upload = NOW()
        WHERE id = ?`, [originalname, fileUrl, id]);
            res.status(200).json({
                success: true,
                message: 'Comprovante enviado com sucesso',
                data: {
                    anexoId,
                    filename,
                    url: fileUrl,
                    originalname,
                },
            });
        }
        catch (error) {
            console.error('Erro ao fazer upload do comprovante:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao fazer upload do comprovante',
            });
        }
    }
}
exports.PagamentoController = PagamentoController;
//# sourceMappingURL=PagamentoController.js.map