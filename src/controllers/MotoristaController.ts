import { Request, Response } from 'express';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate } from '../utils/sql';
import { AtualizarMotoristaSchemaWithVinculo } from '../utils/validators';

const MOTORISTA_FIELDS = [
  'id',
  'nome',
  'cpf',
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
  async listar(_req: Request, res: Response): Promise<void> {
    try {
      const [rows] = await pool.execute('SELECT * FROM motoristas ORDER BY created_at DESC');
      res.json({
        success: true,
        message: 'Motoristas listados com sucesso',
        data: rows,
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
    try {
      const {
        nome, cpf, telefone, email, endereco, status, tipo,
        tipo_pagamento, chave_pix_tipo, chave_pix,
        banco, agencia, conta, tipo_conta
      } = req.body;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // 1. INSERT sem ID manual
        const insertSql = `INSERT INTO motoristas (
          nome, cpf, telefone, email, endereco,
          status, tipo, tipo_pagamento, chave_pix_tipo, chave_pix,
          banco, agencia, conta, tipo_conta, receita_gerada, viagens_realizadas
        ) VALUES (${new Array(16).fill('?').join(',')})`;
        const insertParams = [
          nome,
          cpf ?? null,
          telefone,
          email ?? null,
          endereco ?? null,
          status || 'ativo',
          tipo,
          tipo_pagamento,
          chave_pix_tipo ?? null,
          chave_pix ?? null,
          banco ?? null,
          agencia ?? null,
          conta ?? null,
          tipo_conta ?? null,
          0.00,
          0
        ];
        const [result]: any = await conn.execute(insertSql, insertParams);
        const insertId = result.insertId;

        // 2. Geração da sigla/código
        // Exemplo: MOT-2026-001
        const ano = new Date().getFullYear();
        const codigo = `MOT-${ano}-${String(insertId).padStart(3, '0')}`;
        await conn.execute('UPDATE motoristas SET id = ? WHERE id = ?', [codigo, insertId]);

        await conn.commit();

        res.status(201).json({
          success: true,
          id: codigo
        });
        return;
      } catch (txError) {
        await conn.rollback();
        console.error("[MOTORISTA][ERRO TRANSACTION]", txError);
        res.status(500).json({
          success: false,
          message: "Erro ao criar motorista (transação)."
        });
        return;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("[MOTORISTA][ERRO SQL]", error);
      res.status(500).json({
        success: false,
        message: "Erro ao criar motorista no banco de dados."
      });
      return;
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Normalize empty strings to null for update payloads
      const cleanedRequest: any = { ...req.body };
      ['email', 'banco', 'agencia', 'conta', 'chave_pix', 'tipo_conta', 'endereco']
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
        message: 'Erro ao atualizar motorista',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [result] = await pool.execute('DELETE FROM motoristas WHERE id = ?', [id]);
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
        message: 'Motorista removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao remover motorista',
      } as ApiResponse<null>);
    }
  }

}

export const MotoristaController = new _MotoristaController();
