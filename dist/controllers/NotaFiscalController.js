"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotaFiscalController = void 0;
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const NOTA_FISCAL_FIELDS = [
    'frete_id',
    'motorista_id',
    'numero_nf',
    'serie_nf',
    'data_emissao',
    'data_saida',
    'data_entrega',
    'mercadoria',
    'quantidade_sacas',
    'toneladas',
    'origem',
    'destino',
    'valor_bruto',
    'icms_aliquota',
    'icms_valor',
    'valor_liquido',
    'status',
    'chave_acesso',
    'arquivo_pdf',
    'arquivo_xml',
    'observacoes',
];
const buildNotaFiscalId = () => {
    const suffix = Date.now().toString().slice(-8);
    return `NF-${suffix}`;
};
class NotaFiscalController {
    async listar(_req, res) {
        try {
            const [rows] = await connection_1.default.execute('SELECT * FROM notas_fiscais ORDER BY created_at DESC');
            res.json({
                success: true,
                message: 'Notas fiscais listadas com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao listar notas fiscais',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute('SELECT * FROM notas_fiscais WHERE id = ? LIMIT 1', [id]);
            const notas = rows;
            if (notas.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Nota fiscal nao encontrada',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Nota fiscal carregada com sucesso',
                data: notas[0],
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao obter nota fiscal',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarNotaFiscalSchema.parse(req.body);
            const id = payload.id || buildNotaFiscalId();
            const serieNf = payload.serie_nf || '1';
            const icmsAliquota = payload.icms_aliquota !== undefined ? payload.icms_aliquota : 18.0;
            const icmsValor = payload.icms_valor !== undefined
                ? payload.icms_valor
                : (Number(payload.valor_bruto) * Number(icmsAliquota)) / 100;
            const valorLiquido = payload.valor_liquido !== undefined
                ? payload.valor_liquido
                : Number(payload.valor_bruto) - Number(icmsValor);
            const status = payload.status || 'emitida';
            await connection_1.default.execute(`INSERT INTO notas_fiscais (
          id, frete_id, motorista_id, numero_nf, serie_nf, data_emissao, data_saida,
          data_entrega, mercadoria, quantidade_sacas, toneladas, origem, destino,
          valor_bruto, icms_aliquota, icms_valor, valor_liquido, status, chave_acesso,
          arquivo_pdf, arquivo_xml, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                payload.frete_id,
                payload.motorista_id,
                payload.numero_nf,
                serieNf,
                payload.data_emissao,
                payload.data_saida || null,
                payload.data_entrega || null,
                payload.mercadoria,
                payload.quantidade_sacas,
                payload.toneladas,
                payload.origem,
                payload.destino,
                payload.valor_bruto,
                icmsAliquota,
                icmsValor,
                valorLiquido,
                status,
                payload.chave_acesso || null,
                payload.arquivo_pdf || null,
                payload.arquivo_xml || null,
                payload.observacoes || null,
            ]);
            res.status(201).json({
                success: true,
                message: 'Nota fiscal criada com sucesso',
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
                message: 'Erro ao criar nota fiscal',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarNotaFiscalSchema.parse(req.body);
            const { fields, values } = (0, sql_1.buildUpdate)(payload, NOTA_FISCAL_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE notas_fiscais SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Nota fiscal nao encontrada',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Nota fiscal atualizada com sucesso',
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
                message: 'Erro ao atualizar nota fiscal',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM notas_fiscais WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Nota fiscal nao encontrada',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Nota fiscal removida com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover nota fiscal',
            });
        }
    }
}
exports.NotaFiscalController = NotaFiscalController;
//# sourceMappingURL=NotaFiscalController.js.map