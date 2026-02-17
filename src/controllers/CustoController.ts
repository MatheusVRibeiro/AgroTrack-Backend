import { Request, Response } from 'express';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate } from '../utils/sql';
import { AtualizarCustoSchema, CriarCustoSchema } from '../utils/validators';

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

export class CustoController {
  async listar(_req: Request, res: Response): Promise<void> {
    try {
      const [rows] = await pool.execute('SELECT * FROM custos ORDER BY created_at DESC');
      res.json({
        success: true,
        message: 'Custos listados com sucesso',
        data: rows,
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao listar custos',
      } as ApiResponse<null>);
    }
  }

  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [rows] = await pool.execute('SELECT * FROM custos WHERE id = ? LIMIT 1', [id]);
      const custos = rows as unknown[];

      if (custos.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Custo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Custo carregado com sucesso',
        data: custos[0],
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao obter custo',
      } as ApiResponse<null>);
    }
  }

  async criar(req: Request, res: Response): Promise<void> {
    try {
      console.log('📦 [CUSTO] Requisição recebida - Body:', JSON.stringify(req.body));
      const payload = CriarCustoSchema.parse(req.body);
      console.log('✅ [CUSTO] Payload validado:', payload);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [freteRows] = await connection.execute('SELECT id FROM fretes WHERE id = ? LIMIT 1', [
          payload.frete_id,
        ]);
        const fretes = freteRows as unknown[];

        if (fretes.length === 0) {
          await connection.rollback();
          res.status(404).json({
            success: false,
            message: 'Frete nao encontrado',
          } as ApiResponse<null>);
          return;
        }

        // 1. INSERT sem ID manual
        const [result]: any = await connection.execute(
          `INSERT INTO custos (
            frete_id, tipo, descricao, valor, data, comprovante,
            observacoes, motorista, caminhao, rota, litros, tipo_combustivel
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ]
        );
        const insertId = result.insertId;

        await connection.execute(
          `UPDATE fretes
           SET custos = IFNULL(custos, 0) + ?,
               resultado = IFNULL(receita, 0) - (IFNULL(custos, 0) + ?)
           WHERE id = ?`,
          [payload.valor, payload.valor, payload.frete_id]
        );

        await connection.commit();

        res.status(201).json({
          success: true,
          message: 'Custo criado com sucesso',
          data: { id: insertId },
        } as ApiResponse<{ id: number }>);
        return;
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.log('⚠️ [CUSTO] Erro de validação Zod:', error.errors);
        res.status(400).json({
          success: false,
          message: 'Dados invalidos',
          error: error.errors.map((err) => err.message).join('; '),
        } as ApiResponse<null>);
        return;
      }

      console.error('💥 [CUSTO] Erro inesperado ao criar custo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar custo',
      } as ApiResponse<null>);
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payload = AtualizarCustoSchema.parse(req.body);
      const { fields, values } = buildUpdate(payload as Record<string, unknown>, CUSTO_FIELDS);

      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Nenhum campo valido para atualizar',
        } as ApiResponse<null>);
        return;
      }

      const sql = `UPDATE custos SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);
      const [result] = await pool.execute(sql, values);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Custo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Custo atualizado com sucesso',
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
        message: 'Erro ao atualizar custo',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [result] = await pool.execute('DELETE FROM custos WHERE id = ?', [id]);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Custo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Custo removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao remover custo',
      } as ApiResponse<null>);
    }
  }
}
