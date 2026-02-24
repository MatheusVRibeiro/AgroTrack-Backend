import { Response } from 'express';
import pool from '../database/connection';
import { ApiResponse, AuthRequest } from '../types';
import { buildUpdate, getPagination, QueryBuilder } from '../utils/sql';
import { AtualizarFreteSchema, CriarFreteSchema } from '../utils/validators';
import { sendValidationError } from '../utils/validation';
import { ValidationService } from '../services/ValidationService';
import { FazendaService } from '../services/FazendaService';

const FRETE_FIELDS = [
  'codigo_frete',
  'origem',
  'destino',
  'motorista_id',
  'motorista_nome',
  'caminhao_id',
  'ticket',
  'numero_nota_fiscal',
  'caminhao_placa',
  'fazenda_id',
  'fazenda_nome',
  'mercadoria',
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
  private async backfillCodigosFrete(): Promise<void> {
    await pool.execute(
      `UPDATE fretes
       SET codigo_frete = CONCAT('FRT-', YEAR(COALESCE(created_at, NOW())), '-', LPAD(id, 3, '0'))
       WHERE codigo_frete IS NULL OR codigo_frete = ''`
    );
  }

  // Gerar próximo código sequencial de frete (FRT-2026-001, FRT-2026-002...)
  private async gerarProximoCodigoFrete(): Promise<string> {
    const anoAtual = new Date().getFullYear();
    const prefixo = `FRT-${anoAtual}-`;

    try {
      // Buscar o último código de frete do ano atual
      const [rows] = await pool.execute(
        `SELECT codigo_frete FROM fretes WHERE codigo_frete LIKE ? ORDER BY codigo_frete DESC LIMIT 1`,
        [`${prefixo}%`]
      );

      const fretes = rows as Array<{ codigo_frete: string | null }>;

      if (fretes.length === 0) {
        return `${prefixo}001`;
      }

      const ultimoCodigo = fretes[0].codigo_frete || '';
      const ultimoNumero = parseInt(ultimoCodigo.split('-')[2] || '0', 10);
      const proximoNumero = ultimoNumero + 1;

      return `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;
    } catch (error) {
      // Se a coluna codigo_frete não existir, usar um ID baseado em timestamp
      console.warn('⚠️ [FRETES] Coluna codigo_frete não existe. Usando fallback com ID timestamp.');
      const timestamp = Date.now();
      return `${prefixo}X${timestamp}`;
    }
  }

  async listar(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.backfillCodigosFrete();
      const { page, limit, offset } = getPagination(req.query as Record<string, unknown>);

      const baseSql = `
        SELECT 
          f.*,
          COALESCE(f.motorista_nome, m.nome) as motorista_nome,
          f.motorista_id as proprietario_id,
          COALESCE(f.motorista_nome, m.nome) as proprietario_nome,
          COALESCE(f.caminhao_placa, fr.placa) as caminhao_placa,
          m.tipo as motorista_tipo,
          m.tipo as proprietario_tipo,
          fr.modelo as caminhao_modelo
        FROM fretes f
        LEFT JOIN motoristas m ON m.id = f.motorista_id
        LEFT JOIN frota fr ON fr.id = f.caminhao_id
      `;

      const qb = new QueryBuilder()
        .addCondition('f.data_frete >= ?', req.query.data_inicio)
        .addCondition('f.data_frete <= ?', req.query.data_fim)
        .addCondition('f.motorista_id = ?', req.query.motorista_id || req.query.proprietario_id)
        .addCondition('f.fazenda_id = ?', req.query.fazenda_id);

      const { sql: sqlRows, params } = qb.build(baseSql);
      const { sql: sqlCount } = qb.build('SELECT COUNT(*) as total FROM fretes f');

      const finalSqlRows = `${sqlRows} ORDER BY f.id DESC LIMIT ${limit} OFFSET ${offset}`;

      const [rowsResult, countResult] = await Promise.all([
        pool.execute(finalSqlRows, params),
        pool.execute(sqlCount, params),
      ]);

      const rows = rowsResult[0];
      const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      res.json({
        success: true,
        message: 'Fretes listados com sucesso',
        data: rows,
        meta: { page, limit, total, totalPages },
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
      const motoristaIdParam =
        (req.query.proprietario_id as string | undefined) ??
        (req.query.motorista_id as string | undefined);
      const params: (string | number)[] = [];

      // Query com colunas opcionais usando COALESCE (compatível com DBs antigos)
      let sql = `
        SELECT 
          f.id, 
          COALESCE(f.codigo_frete, NULL) as codigo_frete, 
          f.origem, 
          f.destino, 
          f.motorista_id, 
          f.motorista_nome, 
          f.caminhao_id, 
          f.caminhao_placa, 
          COALESCE(f.ticket, NULL) as ticket, 
          COALESCE(f.numero_nota_fiscal, NULL) as numero_nota_fiscal, 
          f.quantidade_sacas, 
          f.toneladas, 
          f.receita, 
          COALESCE(f.custos, 0) as custos, 
          COALESCE(f.resultado, (f.receita - COALESCE(f.custos, 0))) as resultado, 
          f.data_frete,
          COALESCE(f.motorista_nome, m.nome) as proprietario_nome,
          m.tipo as proprietario_tipo
        FROM fretes f
        LEFT JOIN motoristas m ON m.id = f.motorista_id
        WHERE f.pagamento_id IS NULL
      `;

      if (motoristaIdParam) {
        const motoristaId = Number(motoristaIdParam);
        if (Number.isNaN(motoristaId)) {
          res.status(400).json({ success: false, message: 'motorista_id inválido' } as ApiResponse<null>);
          return;
        }
        sql += ' AND f.motorista_id = ?';
        params.push(motoristaId);
      }

      sql += ' ORDER BY f.data_frete ASC, f.created_at ASC';

      const [rows] = await pool.execute(sql, params);
      const fretes = rows as Array<{
        id: number;
        motorista_id: number;
        motorista_nome: string;
        proprietario_nome: string | null;
        proprietario_tipo: string | null;
        caminhao_id: number;
        caminhao_placa: string | null;
        toneladas: number;
        receita: number;
        custos: number;
        resultado: number;
      }>;

      const agrupadoPorProprietario = Object.values(
        fretes.reduce<Record<string, {
          proprietario_id: number;
          proprietario_nome: string;
          proprietario_tipo: string | null;
          tipo_relatorio: 'GUIA_INTERNA' | 'PAGAMENTO_TERCEIRO';
          quantidade_fretes: number;
          total_toneladas: number;
          valor_total: number;
          total_custos: number;
          resultado_total: number;
          caminhao_ids: number[];
          caminhao_placas: string[];
          fretes: typeof fretes;
        }>>((acc, frete) => {
          const proprietarioId = Number(frete.motorista_id);
          const key = String(proprietarioId);
          const nomeProprietario = frete.proprietario_nome || frete.motorista_nome;
          const tipoRelatorio = frete.proprietario_tipo === 'proprio' ? 'GUIA_INTERNA' : 'PAGAMENTO_TERCEIRO';

          if (!acc[key]) {
            acc[key] = {
              proprietario_id: proprietarioId,
              proprietario_nome: nomeProprietario,
              proprietario_tipo: frete.proprietario_tipo,
              tipo_relatorio: tipoRelatorio,
              quantidade_fretes: 0,
              total_toneladas: 0,
              valor_total: 0,
              total_custos: 0,
              resultado_total: 0,
              caminhao_ids: [],
              caminhao_placas: [],
              fretes: [],
            };
          }

          const grupo = acc[key];
          grupo.quantidade_fretes += 1;
          grupo.total_toneladas += Number(frete.toneladas || 0);
          grupo.valor_total += Number(frete.receita || 0);
          grupo.total_custos += Number(frete.custos || 0);
          grupo.resultado_total += Number(frete.resultado || 0);

          if (!grupo.caminhao_ids.includes(frete.caminhao_id)) {
            grupo.caminhao_ids.push(frete.caminhao_id);
          }
          if (frete.caminhao_placa && !grupo.caminhao_placas.includes(frete.caminhao_placa)) {
            grupo.caminhao_placas.push(frete.caminhao_placa);
          }

          grupo.fretes.push(frete);
          return acc;
        }, {})
      );

      res.json({
        success: true,
        message: 'Fretes pendentes agrupados por proprietário',
        data: agrupadoPorProprietario,
      } as ApiResponse<unknown>);
    } catch (error) {
      console.error('❌ [FRETES] Erro ao listar pendentes:', error);
      console.error('Details:', (error as Error).message);

      // Se o erro for sobre coluna não encontrada, retornar erro informativo
      const errorMsg = (error as Error).message || '';
      if (errorMsg.includes('Unknown column') || errorMsg.includes('COLUMN')) {
        res.status(400).json({
          success: false,
          message: 'Erro na estrutura do banco de dados. Verifique se todas as colunas existem (codigo_frete, numero_nota_fiscal). Execute a migration se necessário.',
          code: 'DB_SCHEMA_ERROR'
        } as ApiResponse<null>);
        return;
      }

      res.status(500).json({ success: false, message: 'Erro ao listar fretes pendentes' } as ApiResponse<null>);
    }
  }

  async obterPorId(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.backfillCodigosFrete();
      const { id } = req.params;

      const [rows] = await pool.execute(`
        SELECT 
          f.*,
          COALESCE(f.motorista_nome, m.nome) as motorista_nome,
          f.motorista_id as proprietario_id,
          COALESCE(f.motorista_nome, m.nome) as proprietario_nome,
          COALESCE(f.caminhao_placa, fr.placa) as caminhao_placa,
          m.tipo as motorista_tipo,
          m.tipo as proprietario_tipo,
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
      const payload = CriarFreteSchema.parse(req.body);
      console.log('[FRETE][CRIAR][PAYLOAD]', payload);

      // Validar se motorista existe
      if (!(await ValidationService.exists('motoristas', Number(payload.motorista_id)))) {
        res.status(400).json({
          success: false,
          message: 'Proprietário não encontrado. Verifique se o ID está correto.',
          field: 'motorista_id',
        } as ApiResponse<null>);
        return;
      }

      // Validar se caminhão existe
      if (!(await ValidationService.exists('frota', Number(payload.caminhao_id)))) {
        res.status(400).json({
          success: false,
          message: 'Caminhão não encontrado. Verifique se o ID está correto.',
          field: 'caminhao_id',
        } as ApiResponse<null>);
        return;
      }

      const receita =
        payload.receita !== undefined
          ? payload.receita
          : Number(payload.toneladas) * Number(payload.valor_por_tonelada);
      const custos = 0;
      const resultado = Number(receita) - Number(custos);

      // Preparar coluna codigo_frete se ela existir no banco
      const codigoPayload =
        payload.id && typeof payload.id === 'string' ? payload.id.trim().toUpperCase() : null;
      const codigoFrete =
        codigoPayload && /^FRT-\d{4}-[A-Z0-9]+$/.test(codigoPayload)
          ? codigoPayload
          : await this.gerarProximoCodigoFrete();

      // Tentar inserir com todas as colunas novas
      const sql = `INSERT INTO fretes (
        codigo_frete, origem, destino, motorista_id, motorista_nome, caminhao_id, ticket, numero_nota_fiscal, caminhao_placa,
        fazenda_id, fazenda_nome, mercadoria, variedade, data_frete,
        quantidade_sacas, toneladas, valor_por_tonelada, receita, custos, resultado, pagamento_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        codigoFrete,
        payload.origem,
        payload.destino,
        payload.motorista_id,
        payload.motorista_nome,
        payload.caminhao_id,
        payload.ticket || null,
        payload.numero_nota_fiscal || null,
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

      const connection = await pool.getConnection();
      let info: { insertId: number };
      try {
        await connection.beginTransaction();

        const [result] = await connection.execute(sql, values);
        info = result as { insertId: number };

        if (payload.fazenda_id) {
          await FazendaService.recalcularTotais(connection, payload.fazenda_id);
        }

        await connection.commit();
      } catch (txError) {
        await connection.rollback();
        throw txError;
      } finally {
        connection.release();
      }

      res.status(201).json({
        success: true,
        message: 'Frete criado com sucesso',
        data: { id: info.insertId, codigo_frete: codigoFrete },
      } as ApiResponse<{ id: number; codigo_frete: string }>);
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      // Tratamento especial para colunas faltantes
      const errorMsg = (error as Error).message || '';
      if (errorMsg.includes('Unknown column') || errorMsg.includes('codigo_frete') || errorMsg.includes('numero_nota_fiscal')) {
        console.warn('⚠️ [FRETES][CRIAR] Colunas novas não encontradas. Use o comando ALTER TABLE para adicionar.');
        res.status(400).json({
          success: false,
          message: 'Banco de dados não tem as colunas necessárias. Execute a migration em src/database/migration_add_missing_columns.sql',
          code: 'DB_SCHEMA_OUTDATED'
        });
        return;
      }

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
      console.log('[FRETE][ATUALIZAR][PAYLOAD RECEBIDO]', req.body);
      const payload = AtualizarFreteSchema.parse(req.body);
      console.log('[FRETE][ATUALIZAR][PAYLOAD VALIDADO]', payload);
      const data = { ...payload } as Record<string, unknown>;

      // Validar se motorista existe (se fornecido)
      if (data.motorista_id !== undefined && !(await ValidationService.exists('motoristas', Number(data.motorista_id)))) {
        res.status(400).json({
          success: false,
          message: 'Proprietário não encontrado. Verifique se o ID está correto.',
          field: 'motorista_id',
        } as ApiResponse<null>);
        return;
      }

      // Validar se caminhão existe (se fornecido)
      if (data.caminhao_id !== undefined && !(await ValidationService.exists('frota', Number(data.caminhao_id)))) {
        res.status(400).json({
          success: false,
          message: 'Caminhão não encontrado. Verifique se o ID está correto.',
          field: 'caminhao_id',
        } as ApiResponse<null>);
        return;
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
          'SELECT id, fazenda_id, toneladas, quantidade_sacas, receita, custos FROM fretes WHERE id = ? LIMIT 1',
          [id]
        );
        const existentes = existingRows as Array<{
          id: number;
          fazenda_id: number | null;
          toneladas: number;
          quantidade_sacas: number;
          receita: number;
          custos: number;
        }>;

        if (existentes.length === 0) {
          await connection.rollback();
          res.status(404).json({
            success: false,
            message: 'Frete nao encontrado',
          } as ApiResponse<null>);
          return;
        }

        const atual = existentes[0];

        if (data.receita === undefined) {
          if (typeof data.toneladas === 'number' && typeof data.valor_por_tonelada === 'number') {
            data.receita = Number(data.toneladas) * Number(data.valor_por_tonelada);
          }
        }

        const proximaReceita =
          data.receita !== undefined ? Number(data.receita) : Number(atual.receita || 0);
        const proximoCusto = data.custos !== undefined ? Number(data.custos) : Number(atual.custos || 0);

        if (data.resultado === undefined && (data.receita !== undefined || data.custos !== undefined || data.toneladas !== undefined || data.valor_por_tonelada !== undefined)) {
          data.resultado = proximaReceita - proximoCusto;
        }

        const { fields, values } = buildUpdate(data, FRETE_FIELDS);
        if (fields.length === 0) {
          await connection.rollback();
          res.status(400).json({
            success: false,
            message: 'Nenhum campo valido para atualizar',
          } as ApiResponse<null>);
          return;
        }

        const sql = `UPDATE fretes SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id);
        await connection.execute(sql, values);

        const proximaFazendaId =
          data.fazenda_id !== undefined && data.fazenda_id !== null
            ? Number(data.fazenda_id)
            : data.fazenda_id === null
              ? null
              : atual.fazenda_id;

        const fazendaAnterior = atual.fazenda_id;

        if (fazendaAnterior && proximaFazendaId && fazendaAnterior === proximaFazendaId) {
          // Mesma fazenda, só mudou valores — recalcula para garantir consistência
          await FazendaService.recalcularTotais(connection, fazendaAnterior);
        } else {
          // Fazendas diferentes: recalcula os totais em ambas as fazendas envolvidas
          if (fazendaAnterior) {
            await FazendaService.recalcularTotais(connection, fazendaAnterior);
          }
          if (proximaFazendaId) {
            await FazendaService.recalcularTotais(connection, proximaFazendaId);
          }
        }

        await connection.commit();

        res.json({
          success: true,
          message: 'Frete atualizado com sucesso',
          data: { id: Number(id) }
        });
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
      console.error("[FRETE][ATUALIZAR][ERRO 500]", error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar frete',
        error: String(error)
      } as ApiResponse<null>);
    }
  }

  async deletar(req: AuthRequest, res: Response): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;

      await connection.beginTransaction();

      // Buscar o frete antes de deletar para reverter totais da fazenda
      const [freteRows] = await connection.execute(
        'SELECT id, fazenda_id, toneladas, quantidade_sacas, receita, custos FROM fretes WHERE id = ? LIMIT 1',
        [id]
      );
      const fretes = freteRows as Array<{
        id: number;
        fazenda_id: number | null;
        toneladas: number;
        quantidade_sacas: number;
        receita: number;
        custos: number;
      }>;

      if (fretes.length === 0) {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message: 'Frete nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      const frete = fretes[0];

      // 1. Deletar custos filhos do frete
      await connection.execute('DELETE FROM custos WHERE frete_id = ?', [id]);

      // 2. Deletar o frete
      await connection.execute('DELETE FROM fretes WHERE id = ?', [id]);

      // 3. Reverter totais acumulados da fazenda (se vinculada)
      if (frete.fazenda_id) {
        await FazendaService.recalcularTotais(connection, frete.fazenda_id);
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Frete removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        success: false,
        message: 'Erro ao remover frete',
      } as ApiResponse<null>);
    } finally {
      connection.release();
    }
  }
}
