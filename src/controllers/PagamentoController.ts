import { Request, Response } from 'express';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate, getPagination } from '../utils/sql';
import { AtualizarPagamentoSchema, CriarPagamentoSchema } from '../utils/validators';
import { sendValidationError } from '../utils/validation';

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
  'comprovante_nome',
  'comprovante_url',
  'comprovante_data_upload',
  'observacoes',
];

export class PagamentoController {
  private montarFavorecido(motorista: {
    id: number;
    nome: string;
    documento?: string | null;
    tipo_pagamento: 'pix' | 'transferencia_bancaria';
    chave_pix_tipo?: string | null;
    chave_pix?: string | null;
    banco?: string | null;
    agencia?: string | null;
    conta?: string | null;
    tipo_conta?: string | null;
  }) {
    return {
      id: motorista.id,
      nome: motorista.nome,
      documento: motorista.documento || null,
      metodo_pagamento: motorista.tipo_pagamento,
      dados_pix:
        motorista.tipo_pagamento === 'pix'
          ? {
            tipo_chave: motorista.chave_pix_tipo || null,
            chave: motorista.chave_pix || null,
          }
          : null,
      dados_bancarios:
        motorista.tipo_pagamento === 'transferencia_bancaria'
          ? {
            banco: motorista.banco || null,
            agencia: motorista.agencia || null,
            conta: motorista.conta || null,
            tipo_conta: motorista.tipo_conta || null,
          }
          : null,
    };
  }

  // Gerar próximo ID sequencial de pagamento (PAG-2026-001, PAG-2026-002...)
  private async gerarProximoIdPagamento(): Promise<string> {
    const anoAtual = new Date().getFullYear();
    const prefixo = `PAG-${anoAtual}-`;

    // Buscar o último pagamento do ano atual
    const [rows] = await pool.execute(
      `SELECT codigo_pagamento FROM pagamentos WHERE codigo_pagamento LIKE ? ORDER BY codigo_pagamento DESC LIMIT 1`,
      [`${prefixo}%`]
    );

    const pagamentos = rows as Array<{ codigo_pagamento: string }>;

    if (pagamentos.length === 0) {
      return `${prefixo}001`;
    }

    const ultimoCodigo = pagamentos[0].codigo_pagamento;
    const partes = ultimoCodigo.split('-');
    const ultimoNumero = parseInt(partes[2] || '0', 10) || 0;
    const proximoNumero = ultimoNumero + 1;
    return `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;
  }

  // Resolve param which can be numeric `id` or a `codigo_pagamento` like PAG-2026-001
  private async resolvePagamentoId(param: string): Promise<string | null> {
    if (/^\d+$/.test(String(param))) return String(param);

    const [rows] = await pool.execute(
      'SELECT id FROM pagamentos WHERE codigo_pagamento = ? LIMIT 1',
      [param]
    );
    const arr = rows as Array<{ id: number }>;
    if (arr.length === 0) return null;
    return String(arr[0].id);
  }

  async listar(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, offset } = getPagination(req.query as Record<string, unknown>);
      const [rowsResult, countResult, resumoResult] = await Promise.all([
        pool.execute(
          `SELECT 
            p.*, 
            p.motorista_id as proprietario_id,
            p.motorista_nome as proprietario_nome,
            m.tipo as proprietario_tipo,
            m.documento as favorecido_documento,
            m.tipo_pagamento as favorecido_metodo_pagamento,
            m.chave_pix_tipo as favorecido_chave_pix_tipo,
            m.chave_pix as favorecido_chave_pix,
            m.banco as favorecido_banco,
            m.agencia as favorecido_agencia,
            m.conta as favorecido_conta,
            m.tipo_conta as favorecido_tipo_conta,
            CASE WHEN m.tipo = 'proprio' THEN 'GUIA_INTERNA' ELSE 'PAGAMENTO_TERCEIRO' END as tipo_relatorio
           FROM pagamentos p
           LEFT JOIN motoristas m ON m.id = p.motorista_id
           ORDER BY p.created_at DESC
           LIMIT ${limit} OFFSET ${offset}`
        ),
        pool.execute('SELECT COUNT(*) as total FROM pagamentos'),
        pool.execute(
          `SELECT
            f.motorista_id as proprietario_id,
            COALESCE(MAX(f.motorista_nome), MAX(m.nome)) as proprietario_nome,
            MAX(m.tipo) as proprietario_tipo,
            CASE WHEN MAX(m.tipo) = 'proprio' THEN 'GUIA_INTERNA' ELSE 'PAGAMENTO_TERCEIRO' END as tipo_relatorio,
            COUNT(*) as quantidade_fretes,
            SUM(f.toneladas) as total_toneladas,
            SUM(f.receita) as valor_total,
            SUM(COALESCE(f.custos, 0)) as total_custos,
            SUM(COALESCE(f.resultado, f.receita - COALESCE(f.custos, 0))) as resultado_total
          FROM fretes f
          LEFT JOIN motoristas m ON m.id = f.motorista_id
          WHERE f.pagamento_id IS NOT NULL
          GROUP BY f.motorista_id
          ORDER BY proprietario_nome ASC`
        ),
      ]);
      const rows = (rowsResult[0] as Array<Record<string, unknown>>).map((row) => {
        const favorecido = this.montarFavorecido({
          id: Number(row.motorista_id),
          nome: String(row.motorista_nome || ''),
          documento: row.favorecido_documento as string | null,
          tipo_pagamento: String(row.favorecido_metodo_pagamento || 'pix') as
            | 'pix'
            | 'transferencia_bancaria',
          chave_pix_tipo: row.favorecido_chave_pix_tipo as string | null,
          chave_pix: row.favorecido_chave_pix as string | null,
          banco: row.favorecido_banco as string | null,
          agencia: row.favorecido_agencia as string | null,
          conta: row.favorecido_conta as string | null,
          tipo_conta: row.favorecido_tipo_conta as string | null,
        });

        return {
          ...row,
          metodo_pagamento: favorecido.metodo_pagamento,
          favorecido,
        };
      });
      const resumoFretesPorProprietario = resumoResult[0];
      const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.json({
        success: true,
        message: 'Pagamentos listados com sucesso',
        data: rows,
        resumo_fretes_por_proprietario: resumoFretesPorProprietario,
        meta: { page, limit, total, totalPages },
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao listar pagamentos',
      } as ApiResponse<null>);
    }
  }

  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resolvedId = await this.resolvePagamentoId(id);
      if (!resolvedId) {
        res.status(404).json({
          success: false,
          message: 'Pagamento nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      const [rows] = await pool.execute(
        `SELECT 
          p.*,
          m.tipo as proprietario_tipo,
          m.documento as favorecido_documento,
          m.tipo_pagamento as favorecido_metodo_pagamento,
          m.chave_pix_tipo as favorecido_chave_pix_tipo,
          m.chave_pix as favorecido_chave_pix,
          m.banco as favorecido_banco,
          m.agencia as favorecido_agencia,
          m.conta as favorecido_conta,
          m.tipo_conta as favorecido_tipo_conta,
          CASE WHEN m.tipo = 'proprio' THEN 'GUIA_INTERNA' ELSE 'PAGAMENTO_TERCEIRO' END as tipo_relatorio
        FROM pagamentos p
        LEFT JOIN motoristas m ON m.id = p.motorista_id
        WHERE p.id = ?
        LIMIT 1`,
        [resolvedId]
      );
      const pagamentos = rows as unknown[];

      if (pagamentos.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Pagamento nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      const pagamento = pagamentos[0] as Record<string, unknown>;
      const favorecido = this.montarFavorecido({
        id: Number(pagamento.motorista_id),
        nome: String(pagamento.motorista_nome || ''),
        documento: pagamento.favorecido_documento as string | null,
        tipo_pagamento: String(pagamento.favorecido_metodo_pagamento || 'pix') as
          | 'pix'
          | 'transferencia_bancaria',
        chave_pix_tipo: pagamento.favorecido_chave_pix_tipo as string | null,
        chave_pix: pagamento.favorecido_chave_pix as string | null,
        banco: pagamento.favorecido_banco as string | null,
        agencia: pagamento.favorecido_agencia as string | null,
        conta: pagamento.favorecido_conta as string | null,
        tipo_conta: pagamento.favorecido_tipo_conta as string | null,
      });

      res.json({
        success: true,
        message: 'Pagamento carregado com sucesso',
        data: {
          ...pagamento,
          metodo_pagamento: favorecido.metodo_pagamento,
          favorecido,
        },
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao obter pagamento',
      } as ApiResponse<null>);
    }
  }

  async criar(req: Request, res: Response): Promise<void> {
    try {
      console.log('📦 [PAGAMENTO] Requisição recebida - Body:', JSON.stringify(req.body));
      const payload = CriarPagamentoSchema.parse(req.body);
      console.log('✅ [PAGAMENTO] Payload validado:', payload);

      // Preparar lista de fretes (se informada)
      let fretesList: number[] = [];
      if (payload.fretes_incluidos) {
        fretesList = String(payload.fretes_incluidos)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((v) => Number(v));
      }

      // Verificar fretes não pagos
      if (fretesList.length > 0) {
        const placeholders = fretesList.map(() => '?').join(',');
        const [rows] = await pool.execute(
          `SELECT id, pagamento_id FROM fretes WHERE id IN (${placeholders})`,
          fretesList
        );
        const fretes = rows as Array<{ id: number; pagamento_id: number | null }>;

        const naoEncontrados = fretesList.filter((id) => !fretes.some((f) => f.id === id));
        if (naoEncontrados.length > 0) {
          res.status(400).json({ success: false, message: `Fretes não encontrados: ${naoEncontrados.join(',')}` } as ApiResponse<null>);
          return;
        }

        const jaPagos = fretes.filter((f) => f.pagamento_id !== null).map((f) => f.id);
        if (jaPagos.length > 0) {
          res.status(400).json({ success: false, message: `Alguns fretes já estão pagos: ${jaPagos.join(',')}` } as ApiResponse<null>);
          return;
        }
      }

      const codigoPagamento = (payload.id && typeof payload.id === 'string') ? payload.id : await this.gerarProximoIdPagamento();
      const status = payload.status || 'pendente';

      const [motoristaRows] = await pool.execute(
        `SELECT
          id,
          nome,
          documento,
          tipo,
          tipo_pagamento,
          chave_pix_tipo,
          chave_pix,
          banco,
          agencia,
          conta,
          tipo_conta
         FROM motoristas
         WHERE id = ?
         LIMIT 1`,
        [payload.motorista_id]
      );
      const motoristas = motoristaRows as Array<{
        id: number;
        nome: string;
        documento: string | null;
        tipo: 'proprio' | 'terceirizado' | 'agregado';
        tipo_pagamento: 'pix' | 'transferencia_bancaria';
        chave_pix_tipo: string | null;
        chave_pix: string | null;
        banco: string | null;
        agencia: string | null;
        conta: string | null;
        tipo_conta: string | null;
      }>;
      if (motoristas.length === 0) {
        res.status(400).json({ success: false, message: 'Proprietário não encontrado' } as ApiResponse<null>);
        return;
      }
      const motorista = motoristas[0];
      const tipoRelatorio = motorista.tipo === 'proprio' ? 'GUIA_INTERNA' : 'PAGAMENTO_TERCEIRO';
      const metodoPagamento = motorista.tipo_pagamento;
      const favorecido = this.montarFavorecido(motorista);

      // Inserir pagamento dentro de transação e vincular fretes
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [result]: any = await conn.execute(
          `INSERT INTO pagamentos (
            codigo_pagamento, motorista_id, motorista_nome, periodo_fretes, quantidade_fretes, fretes_incluidos,
            total_toneladas, valor_por_tonelada, valor_total, data_pagamento, status, metodo_pagamento,
            comprovante_nome, comprovante_url, comprovante_data_upload, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            codigoPagamento,
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
            metodoPagamento,
            payload.comprovante_nome || null,
            payload.comprovante_url || null,
            payload.comprovante_data_upload || null,
            payload.observacoes || null,
          ]
        );

        const insertId = result.insertId;

        if (fretesList.length > 0) {
          const placeholders = fretesList.map(() => '?').join(',');
          await conn.execute(`UPDATE fretes SET pagamento_id = ? WHERE id IN (${placeholders})`, [insertId, ...fretesList]);
        }

        await conn.commit();

        res.status(201).json({
          success: true,
          message: 'Pagamento criado com sucesso',
          data: {
            id: insertId,
            codigo_pagamento: codigoPagamento,
            proprietario_id: payload.motorista_id,
            proprietario_nome: payload.motorista_nome,
            tipo_relatorio: tipoRelatorio,
            metodo_pagamento: metodoPagamento,
            favorecido,
          },
        } as ApiResponse<{ id: number; codigo_pagamento: string }>);
        return;
      } catch (txError) {
        await conn.rollback();
        throw txError;
      } finally {
        conn.release();
      }
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      console.error('💥 [PAGAMENTO] Erro inesperado ao criar pagamento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar pagamento',
      } as ApiResponse<null>);
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resolvedId = await this.resolvePagamentoId(id);
      if (!resolvedId) {
        res.status(404).json({
          success: false,
          message: 'Pagamento nao encontrado',
        } as ApiResponse<null>);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'metodo_pagamento')) {
        res.status(400).json({
          success: false,
          message: 'metodo_pagamento não pode ser alterado manualmente. Ele é definido no cadastro do motorista.',
        } as ApiResponse<null>);
        return;
      }

      const payload = AtualizarPagamentoSchema.parse(req.body);
      const { fields, values } = buildUpdate(payload as Record<string, unknown>, PAGAMENTO_FIELDS);

      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Nenhum campo valido para atualizar',
        } as ApiResponse<null>);
        return;
      }

      const sql = `UPDATE pagamentos SET ${fields.join(', ')} WHERE id = ?`;
      values.push(resolvedId);
      const [result] = await pool.execute(sql, values);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Pagamento nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Pagamento atualizado com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar pagamento',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resolvedId = await this.resolvePagamentoId(id);
      if (!resolvedId) {
        res.status(404).json({
          success: false,
          message: 'Pagamento nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Faz com que os fretes voltem a ficar pendentes (sem guia de pagamento associada)
        await connection.execute(
          'UPDATE fretes SET pagamento_id = NULL WHERE pagamento_id = ?',
          [resolvedId]
        );

        // Deletar o pagamento
        await connection.execute('DELETE FROM pagamentos WHERE id = ?', [resolvedId]);

        await connection.commit();

        res.json({
          success: true,
          message: 'Pagamento removido. Os fretes vinculados voltaram a ficar pendentes.',
        } as ApiResponse<null>);
      } catch (error) {
        await connection.rollback();
        res.status(500).json({
          success: false,
          message: 'Erro ao remover pagamento',
        } as ApiResponse<null>);
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Erro na rota deletar pagamento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar solicitação de exclusão.',
      } as ApiResponse<null>);
    }
  }



  async uploadComprovante(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const resolvedId = await this.resolvePagamentoId(id);
      if (!resolvedId) {
        res.status(404).json({
          success: false,
          message: 'Pagamento não encontrado',
        } as ApiResponse<null>);
        return;
      }

      // Verificar se o pagamento existe
      const [pagamentos] = await pool.execute('SELECT * FROM pagamentos WHERE id = ? LIMIT 1', [
        resolvedId,
      ]);
      const pagamentoArray = pagamentos as unknown[];

      if (pagamentoArray.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Pagamento não encontrado',
        } as ApiResponse<null>);
        return;
      }

      // Verificar se o arquivo foi enviado
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado',
        } as ApiResponse<null>);
        return;
      }

      const { filename, mimetype, size, originalname } = req.file;
      // anexoId deve ser gerado pelo banco ou outro mecanismo
      const fileUrl = `/uploads/${filename}`;

      // Usar transação para garantir atomicidade
      const conn = await pool.getConnection();
      let anexoId: string = '';
      try {
        await conn.beginTransaction();
        // 1. INSERT sem ID manual
        const [result]: any = await conn.execute(
          `INSERT INTO anexos (
            nome_original, nome_arquivo, url, tipo_mime, tamanho,
            entidade_tipo, entidade_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [originalname, filename, fileUrl, mimetype, size, 'pagamento', resolvedId]
        );
        const insertId = result.insertId;
        // 2. Geração da sigla/código
        const ano = new Date().getFullYear();
        anexoId = `ANX-${ano}-${String(insertId).padStart(3, '0')}`;
        await conn.execute('UPDATE anexos SET id = ? WHERE id = ?', [anexoId, insertId]);

        // Atualizar pagamento com dados do comprovante
        await conn.execute(
          `UPDATE pagamentos SET 
            comprovante_nome = ?,
            comprovante_url = ?,
            comprovante_data_upload = NOW()
          WHERE id = ?`,
          [originalname, fileUrl, resolvedId]
        );

        await conn.commit();

        res.status(200).json({
          success: true,
          message: 'Comprovante enviado com sucesso',
          data: {
            anexoId,
            filename,
            url: fileUrl,
            originalname,
          },
        } as ApiResponse<{
          anexoId: string;
          filename: string;
          url: string;
          originalname: string;
        }>);
        return;
      } catch (txError) {
        await conn.rollback();
        res.status(500).json({
          success: false,
          message: 'Erro ao salvar comprovante (transação).',
        } as ApiResponse<null>);
        return;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Erro ao fazer upload do comprovante:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao fazer upload do comprovante',
      } as ApiResponse<null>);
    }
  }
}
