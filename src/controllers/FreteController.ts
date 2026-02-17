import { Response } from 'express';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { ApiResponse, AuthRequest } from '../types';
import { buildUpdate } from '../utils/sql';
import { AtualizarFreteSchema, CriarFreteSchema } from '../utils/validators';

const FRETE_FIELDS = [
  'origem',
  'destino',
  'motorista_id',
  'motorista_nome',
  'caminhao_id',
  'ticket',
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

export class FreteController {
  // Gerar próximo ID sequencial de frete (FRT-2026-001, FRT-2026-002...)
  private async gerarProximoIdFrete(): Promise<string> {
    const anoAtual = new Date().getFullYear();
    const prefixo = `FRT-${anoAtual}-`;

    // Buscar o último frete do ano atual
    const [rows] = await pool.execute(
      `SELECT id FROM fretes WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefixo}%`]
    );

    const fretes = rows as Array<{ id: string }>;

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

  async listar(req: AuthRequest, res: Response): Promise<void> {
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
        LEFT JOIN frota fr ON fr.id = f.caminhao_id
      `;

      const params: (string | Date)[] = [];

      // Filtros opcionais por query params
      const whereClauses: string[] = [];
      
      // Filtro por data inicial
      if (req.query.data_inicio) {
        whereClauses.push('f.data_frete >= ?');
        params.push(req.query.data_inicio as string);
      }
      
      // Filtro por data final
      if (req.query.data_fim) {
        whereClauses.push('f.data_frete <= ?');
        params.push(req.query.data_fim as string);
      }
      
      // Filtro por motorista
      if (req.query.motorista_id) {
        whereClauses.push('f.motorista_id = ?');
        params.push(req.query.motorista_id as string);
      }
      
      // Filtro por fazenda
      if (req.query.fazenda_id) {
        whereClauses.push('f.fazenda_id = ?');
        params.push(req.query.fazenda_id as string);
      }

      if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }

      sql += ' ORDER BY f.data_frete DESC, f.created_at DESC';

      const [rows] = await pool.execute(sql, params);
      
      res.json({
        success: true,
        message: 'Fretes listados com sucesso',
        data: rows,
      } as ApiResponse<unknown>);
    } catch (error) {
      console.error('❌ [FRETES] Erro ao listar:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar fretes',
      } as ApiResponse<null>);
    }
  }

  async pendentes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const motoristaIdParam = req.query.motorista_id as string | undefined;
      const params: (string | number)[] = [];
      let sql = `SELECT id, codigo_frete, origem, destino, motorista_id, motorista_nome, caminhao_id, caminhao_placa, quantidade_sacas, toneladas, receita, custos, resultado, data_frete FROM fretes WHERE pagamento_id IS NULL`;

      if (motoristaIdParam) {
        const motoristaId = Number(motoristaIdParam);
        if (Number.isNaN(motoristaId)) {
          res.status(400).json({ success: false, message: 'motorista_id inválido' } as ApiResponse<null>);
          return;
        }
        sql += ' AND motorista_id = ?';
        params.push(motoristaId);
      }

      sql += ' ORDER BY data_frete ASC, created_at ASC';

      const [rows] = await pool.execute(sql, params);
      res.json({ success: true, message: 'Fretes pendentes listados', data: rows } as ApiResponse<unknown>);
    } catch (error) {
      console.error('❌ [FRETES] Erro ao listar pendentes:', error);
      res.status(500).json({ success: false, message: 'Erro ao listar fretes pendentes' } as ApiResponse<null>);
    }
  }

  async obterPorId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const [rows] = await pool.execute(`
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
        LEFT JOIN frota fr ON fr.id = f.caminhao_id
        WHERE f.id = ?
        LIMIT 1
      `, [id]);
      
      const fretes = rows as unknown[];

      if (fretes.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Frete nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Frete carregado com sucesso',
        data: fretes[0],
      } as ApiResponse<unknown>);
    } catch (error) {
      console.error('❌ [FRETES] Erro ao obter frete:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter frete',
      } as ApiResponse<null>);
    }
  }

  async criar(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('[FRETE][CRIAR][REQ.BODY]', req.body);
      let payload;
      try {
        payload = CriarFreteSchema.parse(req.body);
      } catch (err) {
        console.error('[FRETE][CRIAR][VALIDACAO][ERRO]', err);
        res.status(400).json({
          success: false,
          message: 'Dados inválidos para criação de frete',
          error: err instanceof Error ? err.message : err
        });
        return;
      }
      console.log('[FRETE][CRIAR][PAYLOAD]', payload);
      const id = payload.id || (await this.gerarProximoIdFrete());

      const receita =
        payload.receita !== undefined
          ? payload.receita
          : Number(payload.toneladas) * Number(payload.valor_por_tonelada);
      const custos = 0;
      const resultado = Number(receita) - Number(custos);

      const sql = `INSERT INTO fretes (
        id, origem, destino, motorista_id, motorista_nome, caminhao_id, ticket, caminhao_placa,
        fazenda_id, fazenda_nome, mercadoria, variedade, data_frete,
        quantidade_sacas, toneladas, valor_por_tonelada, receita, custos, resultado, pagamento_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        id,
        payload.origem,
        payload.destino,
        payload.motorista_id,
        payload.motorista_nome,
        payload.caminhao_id,
        payload.ticket || null,
        payload.caminhao_placa || null,
        payload.fazenda_id || null,
        payload.fazenda_nome || null,
        payload.mercadoria,
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

          await pool.execute(sql, values);

          res.status(201).json({
            success: true,
            message: 'Frete criado com sucesso',
            data: { id },
          } as ApiResponse<{ id: string }>);
        } catch (error) {
          console.error('[FRETE][CRIAR][ERRO 500]', error);
          res.status(500).json({
            success: false,
            message: 'Erro ao criar frete',
            error: error instanceof Error ? error.message : error
          });
          }
      }

  async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payload = AtualizarFreteSchema.parse(req.body);
      const data = { ...payload } as Record<string, unknown>;

      if (data.receita === undefined) {
        if (typeof data.toneladas === 'number' && typeof data.valor_por_tonelada === 'number') {
          data.receita = Number(data.toneladas) * Number(data.valor_por_tonelada);
        }
      }

      if (data.receita !== undefined && data.custos !== undefined && data.resultado === undefined) {
        data.resultado = Number(data.receita) - Number(data.custos);
      }

      const { fields, values } = buildUpdate(data, FRETE_FIELDS);
      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Nenhum campo valido para atualizar',
        } as ApiResponse<null>);
        return;
      }

      const sql = `UPDATE fretes SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);
      const [result] = await pool.execute(sql, values);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Frete nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Frete atualizado com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados invalidos',
          error: error.errors.map((err) => err.message).join('; '),
        } as ApiResponse<null>);
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar frete',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [result] = await pool.execute('DELETE FROM fretes WHERE id = ?', [id]);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Frete nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Frete removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao remover frete',
      } as ApiResponse<null>);
    }
  }
}
