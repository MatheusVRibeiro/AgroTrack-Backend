import { Request, Response } from 'express';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate, getPagination } from '../utils/sql';
import { AtualizarCustoSchema, CriarCustoInput, CriarCustoSchema } from '../utils/validators';
import { sendValidationError } from '../utils/validation';

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
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, offset } = getPagination(req.query as Record<string, unknown>);
      const [rowsResult, countResult] = await Promise.all([
        pool.execute(`SELECT * FROM custos ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`),
        pool.execute('SELECT COUNT(*) as total FROM custos'),
      ]);
      const rows = rowsResult[0];
      const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.json({
        success: true,
        message: 'Custos listados com sucesso',
        data: rows,
        meta: { page, limit, total, totalPages },
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
      const rawBody = req.body as {
        frete_id?: number | string;
        custos?: Array<Record<string, unknown>>;
      };

      let payloads: CriarCustoInput[] = [];

      if (Array.isArray(rawBody.custos)) {
        if (rawBody.custos.length === 0) {
          res.status(400).json({
            success: false,
            message: 'Informe ao menos um custo para criar',
          } as ApiResponse<null>);
          return;
        }

        payloads = rawBody.custos.map((item) =>
          CriarCustoSchema.parse({
            ...item,
            frete_id: (item as { frete_id?: number | string }).frete_id ?? rawBody.frete_id,
          })
        );
      } else {
        payloads = [CriarCustoSchema.parse(req.body)];
      }

      console.log('✅ [CUSTO] Payload(s) validado(s):', payloads.length);

      const freteIds = [...new Set(payloads.map((item) => String(item.frete_id)))];
      if (freteIds.length !== 1) {
        res.status(400).json({
          success: false,
          message: 'Para criacao em lote, todos os custos devem ser do mesmo frete',
        } as ApiResponse<null>);
        return;
      }

      const freteId = payloads[0].frete_id;
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [freteRows] = await connection.execute('SELECT id, pagamento_id FROM fretes WHERE id = ? LIMIT 1', [
          freteId,
        ]);
        const fretes = freteRows as Array<{ id: number; pagamento_id: number | null }>;

        if (fretes.length === 0) {
          await connection.rollback();
          res.status(404).json({
            success: false,
            message: 'Frete nao encontrado',
          } as ApiResponse<null>);
          return;
        }

        if (fretes[0].pagamento_id !== null) {
          await connection.rollback();
          res.status(400).json({
            success: false,
            message: 'Nao e permitido vincular custo a frete ja pago',
          } as ApiResponse<null>);
          return;
        }

        const createdIds: number[] = [];
        let totalValor = 0;

        for (const payload of payloads) {
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
          createdIds.push(result.insertId);
          totalValor += Number(payload.valor || 0);
        }

        await connection.execute(
          `UPDATE fretes
           SET custos = IFNULL(custos, 0) + ?,
               resultado = IFNULL(receita, 0) - (IFNULL(custos, 0) + ?)
           WHERE id = ?`,
          [totalValor, totalValor, freteId]
        );

        await connection.commit();

        if (createdIds.length === 1) {
          res.status(201).json({
            success: true,
            message: 'Custo criado com sucesso',
            data: { id: createdIds[0] },
          } as ApiResponse<{ id: number }>);
          return;
        }

        res.status(201).json({
          success: true,
          message: 'Custos criados com sucesso',
          data: {
            ids: createdIds,
            totalCriados: createdIds.length,
            frete_id: freteId,
          },
        } as ApiResponse<{ ids: number[]; totalCriados: number; frete_id: number | string }>);
        return;
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (sendValidationError(res, error)) {
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
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
          `SELECT c.id, c.frete_id, c.valor, f.pagamento_id
           FROM custos c
           INNER JOIN fretes f ON f.id = c.frete_id
           WHERE c.id = ?
           LIMIT 1`,
          [id]
        );
        const existentes = existingRows as Array<{
          id: number;
          frete_id: number;
          valor: number;
          pagamento_id: number | null;
        }>;

        if (existentes.length === 0) {
          await connection.rollback();
          res.status(404).json({
            success: false,
            message: 'Custo nao encontrado',
          } as ApiResponse<null>);
          return;
        }

        const atual = existentes[0];

        if (atual.pagamento_id !== null) {
          await connection.rollback();
          res.status(400).json({
            success: false,
            message: 'Nao e permitido alterar custo de frete ja pago',
          } as ApiResponse<null>);
          return;
        }

        const { fields, values } = buildUpdate(payload as Record<string, unknown>, CUSTO_FIELDS);

        if (fields.length === 0) {
          await connection.rollback();
          res.status(400).json({
            success: false,
            message: 'Nenhum campo valido para atualizar',
          } as ApiResponse<null>);
          return;
        }

        const novoFreteId =
          payload.frete_id !== undefined ? Number(payload.frete_id) : Number(atual.frete_id);
        const novoValor = payload.valor !== undefined ? Number(payload.valor) : Number(atual.valor);

        if (payload.frete_id !== undefined && payload.frete_id !== atual.frete_id) {
          const [freteRows] = await connection.execute(
            'SELECT id, pagamento_id FROM fretes WHERE id = ? LIMIT 1',
            [
            novoFreteId,
            ]
          );
          const fretes = freteRows as Array<{ id: number; pagamento_id: number | null }>;

          if (fretes.length === 0) {
            await connection.rollback();
            res.status(404).json({
              success: false,
              message: 'Frete nao encontrado',
            } as ApiResponse<null>);
            return;
          }

          if (fretes[0].pagamento_id !== null) {
            await connection.rollback();
            res.status(400).json({
              success: false,
              message: 'Nao e permitido vincular custo a frete ja pago',
            } as ApiResponse<null>);
            return;
          }
        }

        const sql = `UPDATE custos SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id);
        await connection.execute(sql, values);

        if (Number(atual.frete_id) === Number(novoFreteId)) {
          const deltaValor = novoValor - Number(atual.valor || 0);
          if (deltaValor !== 0) {
            await connection.execute(
              `UPDATE fretes
               SET custos = GREATEST(0, IFNULL(custos, 0) + ?),
                   resultado = IFNULL(receita, 0) - GREATEST(0, IFNULL(custos, 0) + ?)
               WHERE id = ?`,
              [deltaValor, deltaValor, atual.frete_id]
            );
          }
        } else {
          await connection.execute(
            `UPDATE fretes
             SET custos = GREATEST(0, IFNULL(custos, 0) - ?),
                 resultado = IFNULL(receita, 0) - GREATEST(0, IFNULL(custos, 0) - ?)
             WHERE id = ?`,
            [atual.valor, atual.valor, atual.frete_id]
          );

          await connection.execute(
            `UPDATE fretes
             SET custos = IFNULL(custos, 0) + ?,
                 resultado = IFNULL(receita, 0) - (IFNULL(custos, 0) + ?)
             WHERE id = ?`,
            [novoValor, novoValor, novoFreteId]
          );
        }

        await connection.commit();

        res.json({
          success: true,
          message: 'Custo atualizado com sucesso',
        } as ApiResponse<null>);
      } catch (txError) {
        await connection.rollback();
        throw txError;
      } finally {
        connection.release();
      }
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar custo',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;

      await connection.beginTransaction();

      // Busca o custo antes de deletar para obter valor e frete_id
      const [custoRows] = await connection.execute(
        `SELECT c.id, c.valor, c.frete_id, f.pagamento_id
         FROM custos c
         INNER JOIN fretes f ON f.id = c.frete_id
         WHERE c.id = ?
         LIMIT 1`,
        [id]
      );
      const custos = custoRows as Array<{
        id: number;
        valor: number;
        frete_id: number;
        pagamento_id: number | null;
      }>;

      if (custos.length === 0) {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message: 'Custo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      const { valor, frete_id, pagamento_id } = custos[0];

      if (pagamento_id !== null) {
        await connection.rollback();
        res.status(400).json({
          success: false,
          message: 'Nao e permitido remover custo de frete ja pago',
        } as ApiResponse<null>);
        return;
      }

      // Deleta o custo
      await connection.execute('DELETE FROM custos WHERE id = ?', [id]);

      // Reverte o valor no frete relacionado
      await connection.execute(
        `UPDATE fretes
         SET custos = GREATEST(0, IFNULL(custos, 0) - ?),
             resultado = IFNULL(receita, 0) - GREATEST(0, IFNULL(custos, 0) - ?)
         WHERE id = ?`,
        [valor, valor, frete_id]
      );

      await connection.commit();

      res.json({
        success: true,
        message: 'Custo removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        success: false,
        message: 'Erro ao remover custo',
      } as ApiResponse<null>);
    } finally {
      connection.release();
    }
  }
}
