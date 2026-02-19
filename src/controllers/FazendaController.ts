import { Request, Response } from 'express';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate } from '../utils/sql';
import { AtualizarFazendaSchema, CriarFazendaSchema, IncrementarVolumeSchema } from '../utils/validators';

const FAZENDA_FIELDS = [
  'fazenda',
  'estado',
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

export class FazendaController {
  async listar(_req: Request, res: Response): Promise<void> {
    try {
      const [rows] = await pool.execute(`
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
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao listar fazendas',
      } as ApiResponse<null>);
    }
  }

  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [rows] = await pool.execute('SELECT * FROM fazendas WHERE id = ? LIMIT 1', [id]);
      const fazendas = rows as unknown[];

      if (fazendas.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Fazenda nao encontrada',
        } as ApiResponse<null>);
        return;
      }

      const fazenda = fazendas[0] as {
        faturamento_total?: number | string | null;
      } & Record<string, unknown>;

      // Buscar dados agregados em paralelo
      const [ultimoFreteRows, totalFretesRows, totalCustosRows] = await Promise.all([
        // Último frete desta fazenda
        pool.execute(
          `SELECT id, motorista_nome, caminhao_placa, origem, destino, data_frete
           FROM fretes
           WHERE fazenda_id = ?
           ORDER BY data_frete DESC, created_at DESC
           LIMIT 1`,
          [id]
        ),
        // Total de fretes realizados
        pool.execute('SELECT COUNT(*) AS total FROM fretes WHERE fazenda_id = ?', [id]),
        // Total de custos operacionais (soma dos custos vinculados aos fretes dessa fazenda)
        pool.execute(
          `SELECT COALESCE(SUM(c.valor), 0) AS total
           FROM custos c
           INNER JOIN fretes f ON c.frete_id = f.id
           WHERE f.fazenda_id = ?`,
          [id]
        ),
      ]);

      const ultimoFrete = (ultimoFreteRows[0] as unknown[])[0] as
        | {
            id?: string;
            motorista_nome?: string;
            caminhao_placa?: string;
            origem?: string;
            destino?: string;
            data_frete?: string;
          }
        | undefined;

      const totalFretes = (totalFretesRows[0] as Array<{ total: number }>)[0]?.total ?? 0;
      const totalCustosOperacionais =
        (totalCustosRows[0] as Array<{ total: number | string }>)[0]?.total ?? 0;

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
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao obter fazenda',
      } as ApiResponse<null>);
    }
  }

  async criar(req: Request, res: Response): Promise<void> {
    try {
      console.log('[FAZENDA][CRIAR][REQ.BODY]', req.body);
      const payload = CriarFazendaSchema.parse(req.body);
      console.log('[FAZENDA][CRIAR][PAYLOAD]', payload);
      const pesoMedioSaca = payload.peso_medio_saca !== undefined ? payload.peso_medio_saca : 25.0;
      const colheitaFinalizada = payload.colheita_finalizada !== undefined ? payload.colheita_finalizada : false;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // 1. INSERT sem ID manual
        const insertSql = `INSERT INTO fazendas (
          fazenda, estado, proprietario, mercadoria, variedade, safra,
          preco_por_tonelada, peso_medio_saca, total_sacas_carregadas, total_toneladas,
          faturamento_total, ultimo_frete, colheita_finalizada
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const insertParams = [
          payload.fazenda,
          payload.estado,
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
        ];
        const [result]: any = await conn.execute(insertSql, insertParams);
        const insertId = result.insertId;

        // 2. Geração da sigla/código
        const ano = new Date().getFullYear();
        const codigo = `FAZ-${ano}-${String(insertId).padStart(3, '0')}`;
        await conn.execute('UPDATE fazendas SET codigo_fazenda = ? WHERE id = ?', [codigo, insertId]);

        await conn.commit();

        res.status(201).json({
          success: true,
          message: 'Fazenda criada com sucesso',
          data: { id: insertId, codigo_fazenda: codigo },
        } as ApiResponse<{ id: number; codigo_fazenda: string }>);
        return;
      } catch (txError) {
        await conn.rollback();
        res.status(500).json({
          success: false,
          message: 'Erro ao criar fazenda (transação).',
        } as ApiResponse<null>);
        return;
      } finally {
        conn.release();
      }
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
        message: 'Erro ao criar fazenda',
      } as ApiResponse<null>);
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payload = AtualizarFazendaSchema.parse(req.body);
      const { fields, values } = buildUpdate(payload as Record<string, unknown>, FAZENDA_FIELDS);

      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Nenhum campo valido para atualizar',
        } as ApiResponse<null>);
        return;
      }

      const sql = `UPDATE fazendas SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);
      const [result] = await pool.execute(sql, values);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Fazenda nao encontrada',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Fazenda atualizada com sucesso',
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
        message: 'Erro ao atualizar fazenda',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [result] = await pool.execute('DELETE FROM fazendas WHERE id = ?', [id]);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Fazenda nao encontrada',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Fazenda removida com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao remover fazenda',
      } as ApiResponse<null>);
    }
  }

  async incrementarVolume(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payload = IncrementarVolumeSchema.parse(req.body);

      // Verificar se a fazenda existe
      const [rows] = await pool.execute('SELECT * FROM fazendas WHERE id = ? LIMIT 1', [id]);
      const fazendas = rows as unknown[];

      if (fazendas.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Fazenda não encontrada',
        } as ApiResponse<null>);
        return;
      }

      const fazenda = fazendas[0] as { preco_por_tonelada?: number | string | null };
      const precoPorTonelada = Number(fazenda.preco_por_tonelada || 0);
      const faturamentoIncremento =
        typeof payload.receitaTotal === 'number'
          ? payload.receitaTotal
          : payload.toneladas * precoPorTonelada;

      // Incrementar volume, sacas e faturamento acumulados
      await pool.execute(
        `UPDATE fazendas
         SET total_toneladas = COALESCE(total_toneladas, 0) + ?,
             total_sacas_carregadas = COALESCE(total_sacas_carregadas, 0) + ?,
             faturamento_total = COALESCE(faturamento_total, 0) + ?
         WHERE id = ?`,
        [payload.toneladas, payload.quantidadeSacas || 0, faturamentoIncremento, id]
      );

      // Buscar fazenda atualizada
      const [updatedRows] = await pool.execute('SELECT * FROM fazendas WHERE id = ? LIMIT 1', [id]);
      const fazendaAtualizada = (updatedRows as unknown[])[0];

      res.json({
        success: true,
        message: 'Volume incrementado com sucesso',
        data: fazendaAtualizada,
      } as ApiResponse<unknown>);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          error: error.errors.map((err) => err.message).join('; '),
        } as ApiResponse<null>);
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao incrementar volume',
      } as ApiResponse<null>);
    }
  }
}
