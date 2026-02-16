"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreteController = void 0;
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const FRETE_FIELDS = [
    'origem',
    'destino',
    'motorista_id',
    'motorista_nome',
    'caminhao_id',
    'caminhao_placa',
    'fazenda_id',
    'fazenda_nome',
    'mercadoria',
    'mercadoria_id',
    'variedade',
    'data_frete',
    'quantidade_sacas',
    'toneladas',
    'valor_por_tonelada',
    'receita',
    'custos',
    'resultado',
    'pagamento_id',
];
class FreteController {
    // Gerar próximo ID sequencial de frete (FRT-2026-001, FRT-2026-002...)
    async gerarProximoIdFrete() {
        const anoAtual = new Date().getFullYear();
        const prefixo = `FRT-${anoAtual}-`;
        // Buscar o último frete do ano atual
        const [rows] = await connection_1.default.execute(`SELECT id FROM fretes WHERE id LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefixo}%`]);
        const fretes = rows;
        if (fretes.length === 0) {
            // Primeiro frete do ano
            return `${prefixo}001`;
        }
        // Extrair número sequencial do último ID (FRT-2026-001 -> 001)
        const ultimoId = fretes[0].id;
        const ultimoNumero = parseInt(ultimoId.split('-')[2], 10);
        const proximoNumero = ultimoNumero + 1;
        // Formatar com 3 dígitos (001, 002, ..., 999)
        return `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;
    }
    async listar(req, res) {
        try {
            // Query com JOINs para garantir dados atualizados
            // Também usa os campos cache (motorista_nome, caminhao_placa) como fallback
            let sql = `
        SELECT 
          f.*,
          COALESCE(f.motorista_nome, m.nome) as motorista_nome,
          COALESCE(f.caminhao_placa, fr.placa) as caminhao_placa,
          m.tipo as motorista_tipo,
          fr.modelo as caminhao_modelo
        FROM fretes f
        LEFT JOIN motoristas m ON m.id = f.motorista_id
        LEFT JOIN Frota fr ON fr.id = f.caminhao_id
      `;
            const params = [];
            // Filtros opcionais por query params
            const whereClauses = [];
            // Filtro por data inicial
            if (req.query.data_inicio) {
                whereClauses.push('f.data_frete >= ?');
                params.push(req.query.data_inicio);
            }
            // Filtro por data final
            if (req.query.data_fim) {
                whereClauses.push('f.data_frete <= ?');
                params.push(req.query.data_fim);
            }
            // Filtro por motorista
            if (req.query.motorista_id) {
                whereClauses.push('f.motorista_id = ?');
                params.push(req.query.motorista_id);
            }
            // Filtro por fazenda
            if (req.query.fazenda_id) {
                whereClauses.push('f.fazenda_id = ?');
                params.push(req.query.fazenda_id);
            }
            if (whereClauses.length > 0) {
                sql += ' WHERE ' + whereClauses.join(' AND ');
            }
            sql += ' ORDER BY f.data_frete DESC, f.created_at DESC';
            const [rows] = await connection_1.default.execute(sql, params);
            res.json({
                success: true,
                message: 'Fretes listados com sucesso',
                data: rows,
            });
        }
        catch (error) {
            console.error('❌ [FRETES] Erro ao listar:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao listar fretes',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute(`
        SELECT 
          f.*,
          COALESCE(f.motorista_nome, m.nome) as motorista_nome,
          COALESCE(f.caminhao_placa, fr.placa) as caminhao_placa,
          m.tipo as motorista_tipo,
          m.telefone as motorista_telefone,
          fr.modelo as caminhao_modelo,
          fr.tipo_veiculo as caminhao_tipo
        FROM fretes f
        LEFT JOIN motoristas m ON m.id = f.motorista_id
        LEFT JOIN Frota fr ON fr.id = f.caminhao_id
        WHERE f.id = ?
        LIMIT 1
      `, [id]);
            const fretes = rows;
            if (fretes.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Frete nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Frete carregado com sucesso',
                data: fretes[0],
            });
        }
        catch (error) {
            console.error('❌ [FRETES] Erro ao obter frete:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao obter frete',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarFreteSchema.parse(req.body);
            const id = payload.id || (await this.gerarProximoIdFrete());
            const receita = payload.receita !== undefined
                ? payload.receita
                : Number(payload.toneladas) * Number(payload.valor_por_tonelada);
            const custos = 0;
            const resultado = Number(receita) - Number(custos);
            const sql = `INSERT INTO fretes (
        id, origem, destino, motorista_id, motorista_nome, caminhao_id, caminhao_placa,
        fazenda_id, fazenda_nome, mercadoria, mercadoria_id, variedade, data_frete,
        quantidade_sacas, toneladas, valor_por_tonelada, receita, custos, resultado, pagamento_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const values = [
                id,
                payload.origem,
                payload.destino,
                payload.motorista_id,
                payload.motorista_nome,
                payload.caminhao_id,
                payload.caminhao_placa,
                payload.fazenda_id || null,
                payload.fazenda_nome || null,
                payload.mercadoria,
                payload.mercadoria_id || null,
                payload.variedade || null,
                payload.data_frete,
                payload.quantidade_sacas,
                payload.toneladas,
                payload.valor_por_tonelada,
                receita,
                custos,
                resultado,
                payload.pagamento_id || null,
            ];
            const connection = await connection_1.default.getConnection();
            try {
                await connection.beginTransaction();
                if (payload.fazenda_id) {
                    const [fazendaRows] = await connection.execute('SELECT id FROM fazendas WHERE id = ? LIMIT 1', [payload.fazenda_id]);
                    const fazendas = fazendaRows;
                    if (fazendas.length === 0) {
                        await connection.rollback();
                        res.status(404).json({
                            success: false,
                            message: 'Fazenda nao encontrada',
                        });
                        return;
                    }
                }
                await connection.execute(sql, values);
                if (payload.fazenda_id) {
                    await connection.execute(`UPDATE fazendas
             SET total_sacas_carregadas = total_sacas_carregadas + ?,
                 total_toneladas = total_toneladas + ?,
                 faturamento_total = faturamento_total + ?,
                 ultimo_frete = ?
             WHERE id = ?`, [payload.quantidade_sacas, payload.toneladas, receita, payload.data_frete, payload.fazenda_id]);
                }
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
                message: 'Frete criado com sucesso',
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
                message: 'Erro ao criar frete',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarFreteSchema.parse(req.body);
            const data = { ...payload };
            if (data.receita === undefined) {
                if (typeof data.toneladas === 'number' && typeof data.valor_por_tonelada === 'number') {
                    data.receita = Number(data.toneladas) * Number(data.valor_por_tonelada);
                }
            }
            if (data.receita !== undefined && data.custos !== undefined && data.resultado === undefined) {
                data.resultado = Number(data.receita) - Number(data.custos);
            }
            const { fields, values } = (0, sql_1.buildUpdate)(data, FRETE_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE fretes SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Frete nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Frete atualizado com sucesso',
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
                message: 'Erro ao atualizar frete',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM fretes WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Frete nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Frete removido com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover frete',
            });
        }
    }
}
exports.FreteController = FreteController;
//# sourceMappingURL=FreteController.js.map