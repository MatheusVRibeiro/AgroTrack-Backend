import { Request, Response } from 'express';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate, getPagination } from '../utils/sql';
import { AtualizarMotoristaSchemaWithVinculo, CriarMotoristaSchemaWithVinculo, sanitizarDocumento } from '../utils/validators';
import { sendValidationError } from '../utils/validation';

const MOTORISTA_FIELDS = [
  'id',
  'nome',
  'documento',
  'telefone',
  'email',
  'endereco',
  'status',
  'tipo',
  'tipo_pagamento',
  'chave_pix_tipo',
  'chave_pix',
  'banco',
  'agencia',
  'conta',
  'tipo_conta',
  'receita_gerada',
  'viagens_realizadas',
];

class _MotoristaController {
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, offset } = getPagination(req.query as Record<string, unknown>);
      const [rowsResult, countResult] = await Promise.all([
        pool.execute(`SELECT * FROM motoristas ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`),
        pool.execute('SELECT COUNT(*) as total FROM motoristas'),
      ]);
      const rows = rowsResult[0];
      const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.json({
        success: true,
        message: 'Motoristas listados com sucesso',
        data: rows,
        meta: { page, limit, total, totalPages },
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao listar motoristas',
      } as ApiResponse<null>);
    }
  }

  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sql = `SELECT ${MOTORISTA_FIELDS.join(', ')} FROM motoristas WHERE id = ?`;
      const [rows] = await pool.execute(sql, [id]) as any;
      const motoristas = rows as unknown[];

      if (motoristas.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Motorista nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      const motorista: any = motoristas[0];
      // fetch bound vehicle (if any)
      const [frotaRows] = await pool.execute('SELECT id, placa, modelo, motorista_fixo_id FROM frota WHERE motorista_fixo_id = ? LIMIT 1', [id]) as any;
      if (frotaRows && frotaRows.length > 0) {
        motorista.veiculo_vinculado = frotaRows[0];
      }
      res.json({
        success: true,
        message: 'Motorista carregado com sucesso',
        data: motorista,
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao obter motorista',
      } as ApiResponse<null>);
    }
  }

  async criar(req: Request, res: Response): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const payload = CriarMotoristaSchemaWithVinculo.parse(req.body);
      // 1. INSERT sem o campo codigo_motorista
      // Certifique-se de que a coluna codigo_motorista no MySQL permite NULL
      const documentoLimpo = payload.documento ? sanitizarDocumento(String(payload.documento)) : null;
      const insertSql = `INSERT INTO motoristas (
        nome, documento, telefone, email, endereco,
        status, tipo, tipo_pagamento, chave_pix_tipo, chave_pix,
        banco, agencia, conta, tipo_conta, receita_gerada, viagens_realizadas
      ) VALUES (${new Array(16).fill('?').join(',')})`;
      const insertParams = [
      payload.nome,
      documentoLimpo,
      payload.telefone,
        payload.email ?? null,
        payload.endereco ?? null,
        payload.status || 'ativo',
        payload.tipo,
        payload.tipo_pagamento,
        payload.chave_pix_tipo ?? null,
        payload.chave_pix ?? null,
        payload.banco ?? null,
        payload.agencia ?? null,
        payload.conta ?? null,
        payload.tipo_conta ?? null,
        0.00,
        0
      ];
      const [result]: any = await connection.execute(insertSql, insertParams);
      const insertId = result.insertId;
      const ano = new Date().getFullYear();
      const novoCodigo = `MOT-${ano}-${String(insertId).padStart(3, '0')}`;
      // 2. UPDATE para colocar o código gerado
      await connection.execute(
        `UPDATE motoristas SET codigo_motorista = ? WHERE id = ?`,
        [novoCodigo, insertId]
      );
      await connection.commit();
      res.status(201).json({ success: true, codigo: novoCodigo });
    } catch (error) {
      await connection.rollback();
      if (sendValidationError(res, error)) {
        return;
      }
      console.error("[MOTORISTA][ERRO TRANSACTION]", error);
      res.status(500).json({ success: false, message: "Erro ao cadastrar motorista" });
    } finally {
      connection.release();
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Normalize empty strings to null for update payloads
      const cleanedRequest: any = { ...req.body };
      ['email', 'banco', 'agencia', 'conta', 'chave_pix', 'tipo_conta', 'endereco', 'veiculo_id']
        .forEach((k) => {
          if (k in cleanedRequest && cleanedRequest[k] === '') cleanedRequest[k] = null;
        });

      const payload = AtualizarMotoristaSchemaWithVinculo.parse(cleanedRequest) as any;

      const { fields, values } = buildUpdate(payload as Record<string, unknown>, MOTORISTA_FIELDS);

      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Nenhum campo valido para atualizar',
        } as ApiResponse<null>);
        return;
      }

      const sql = `UPDATE motoristas SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);
      const [result] = await pool.execute(sql, values);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Motorista nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Motorista atualizado com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar motorista',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;

      await connection.beginTransaction();

      const [motRows] = await connection.execute(
        'SELECT id FROM motoristas WHERE id = ? LIMIT 1',
        [id]
      );
      if ((motRows as unknown[]).length === 0) {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message: 'Motorista nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      // Desvincular veículos que tinham este motorista como fixo
      await connection.execute(
        'UPDATE frota SET motorista_fixo_id = NULL WHERE motorista_fixo_id = ?',
        [id]
      );

      // Deletar o motorista
      await connection.execute('DELETE FROM motoristas WHERE id = ?', [id]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Motorista removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        success: false,
        message: 'Erro ao remover motorista',
      } as ApiResponse<null>);
    } finally {
      connection.release();
    }
  }

}

export const MotoristaController = new _MotoristaController();
