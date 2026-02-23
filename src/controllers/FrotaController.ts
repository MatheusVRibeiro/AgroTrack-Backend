import { Request, Response } from 'express';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate, getPagination } from '../utils/sql';
import { AtualizarCaminhaoSchema, CriarCaminhaoSchema } from '../utils/validators';
import { normalizeCaminhaoPayload } from '../utils/normalizeCaminhaoPayload';
import { sendValidationError } from '../utils/validation';

const FROTA_FIELDS = [
  'placa',
  'placa_carreta',
  'modelo',
  'ano_fabricacao',
  'status',
  'motorista_fixo_id',
  'capacidade_toneladas',
  'km_atual',
  'tipo_combustivel',
  'tipo_veiculo',
  'renavam',
  'renavam_carreta',
  'chassi',
  'registro_antt',
  'validade_seguro',
  'validade_licenciamento',
  'proprietario_tipo',
  'ultima_manutencao_data',
  'proxima_manutencao_km',
];

export class FrotaController {
  async listar(_req: Request, res: Response): Promise<void> {
    try {
        const { page, limit, offset } = getPagination(_req.query as Record<string, unknown>);
        // support query ?vagos=1 to list only vehicles without a fixed driver
        if (_req.query.vagos === '1' || _req.query.vagos === 'true') {
          const sqlVagos = `SELECT id, placa, modelo, ano_fabricacao FROM frota WHERE motorista_fixo_id IS NULL ORDER BY placa ASC LIMIT ${limit} OFFSET ${offset}`;
            const [rowsResult, countResult] = await Promise.all([
              pool.execute(sqlVagos),
              pool.execute('SELECT COUNT(*) as total FROM frota WHERE motorista_fixo_id IS NULL'),
            ]);
            const rows = rowsResult[0];
            const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            res.json({
              success: true,
              message: 'Frota vaga listada com sucesso',
              data: rows,
              meta: { page, limit, total, totalPages },
            } as ApiResponse<unknown>);
            return;
        }

        // Filter by motorista_fixo_id if provided
        if (_req.query.motorista_fixo_id) {
          const motoristaId = Number(_req.query.motorista_fixo_id);

          if (Number.isNaN(motoristaId)) {
            res.status(400).json({
              success: false,
              message: 'motorista_fixo_id invalido',
            } as ApiResponse<null>);
            return;
          }

          const sqlMotorista = `
            SELECT id, placa, placa_carreta, modelo, tipo_veiculo, status
            FROM frota
            WHERE motorista_fixo_id = ?
            ORDER BY placa ASC
            LIMIT ${limit} OFFSET ${offset}
          `;
          const [rowsResult, countResult] = await Promise.all([
            pool.execute(sqlMotorista, [motoristaId]),
            pool.execute('SELECT COUNT(*) as total FROM frota WHERE motorista_fixo_id = ?', [motoristaId]),
          ]);
          const rows = rowsResult[0];
          const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
          const totalPages = Math.max(1, Math.ceil(total / limit));
          res.json({
            success: true,
            message: 'Frota do motorista listada com sucesso',
            data: rows,
            meta: { page, limit, total, totalPages },
          } as ApiResponse<unknown>);
          return;
        }

        const [rowsResult, countResult] = await Promise.all([
          pool.execute(`SELECT * FROM frota ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`),
          pool.execute('SELECT COUNT(*) as total FROM frota'),
        ]);
        const rows = rowsResult[0];
        const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        res.json({
          success: true,
          message: 'Frota listada com sucesso',
          data: rows,
          meta: { page, limit, total, totalPages },
        } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao listar frota',
      } as ApiResponse<null>);
    }
  }

  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [rows] = await pool.execute('SELECT * FROM frota WHERE id = ? LIMIT 1', [id]);
      const frota = rows as unknown[];

      if (frota.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Veiculo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Veiculo carregado com sucesso',
        data: frota[0],
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao obter veiculo',
      } as ApiResponse<null>);
    }
  }

  async criar(req: Request, res: Response): Promise<void> {
    try {
      console.log('[FROTA][CRIAR][REQ.BODY]', req.body);
      const cleaned = normalizeCaminhaoPayload(req.body);
      console.log('[FROTA][CRIAR][NORMALIZADO]', cleaned);
      console.log('[FROTA][CRIAR][TIPOS]', {
        placa: typeof cleaned.placa,
        modelo: typeof cleaned.modelo,
        tipo_veiculo: typeof cleaned.tipo_veiculo,
        status: typeof cleaned.status,
        km_atual: typeof cleaned.km_atual,
      });
      const payload = CriarCaminhaoSchema.parse(cleaned as any);
      console.log('[FROTA][CRIAR][PAYLOAD]', payload);
      
      // Aplicar valores padrão
      const tipoVeiculo = payload.tipo_veiculo;
      const status = payload.status || 'disponivel';
      const tipoCombustivel = payload.tipo_combustivel || 'S10';
      const kmAtual = payload.km_atual ?? null;
      const proprietarioTipo = payload.proprietario_tipo || 'PROPRIO';
      
      const carretaTypes = ['CARRETA', 'BITREM', 'RODOTREM'];

      // Se o tipo de veiculo exige carreta, placa_carreta é obrigatoria
      if (carretaTypes.includes(tipoVeiculo) && !payload.placa_carreta) {
        res.status(400).json({
          success: false,
          message: 'Placa da carreta obrigatoria para o tipo de veiculo selecionado',
        } as ApiResponse<null>);
        return;
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // 1. INSERT sem ID manual
        const insertSql = `INSERT INTO frota (
          placa, placa_carreta, modelo, ano_fabricacao, status, motorista_fixo_id,
          capacidade_toneladas, km_atual, tipo_combustivel, tipo_veiculo, renavam,
          renavam_carreta, chassi, registro_antt, validade_seguro, validade_licenciamento,
          proprietario_tipo, ultima_manutencao_data, proxima_manutencao_km
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const insertParams = [
          payload.placa,
          payload.placa_carreta ?? null,
          payload.modelo,
          payload.ano_fabricacao ?? null,
          status,
          payload.motorista_fixo_id ? Number(payload.motorista_fixo_id) : null,
          payload.capacidade_toneladas ?? null,
          kmAtual,
          tipoCombustivel,
          tipoVeiculo,
          payload.renavam || null,
          payload.renavam_carreta || null,
          payload.chassi || null,
          payload.registro_antt || null,
          payload.validade_seguro || null,
          payload.validade_licenciamento || null,
          proprietarioTipo,
          payload.ultima_manutencao_data || null,
          payload.proxima_manutencao_km || null,
        ];
        const [result]: any = await conn.execute(insertSql, insertParams);
        const insertId = result.insertId;

        // 2. Gerar código_veiculo único
        const ano = new Date().getFullYear();
        const codigoVeiculo = `VEI-${ano}-${String(insertId).padStart(3, '0')}`;
        await conn.execute('UPDATE frota SET codigo_veiculo = ? WHERE id = ?', [codigoVeiculo, insertId]);

        await conn.commit();
        console.log('[FROTA][CRIAR][SUCCESS]', { id: insertId, codigo_veiculo: codigoVeiculo });
        res.status(201).json({
          success: true,
          message: 'Veiculo criado com sucesso',
          data: { id: insertId, codigo_veiculo: codigoVeiculo },
        } as ApiResponse<{ id: number; codigo_veiculo: string }>);
        return;
      } catch (txError) {
        await conn.rollback();
        console.error('[FROTA][CRIAR][TX_ERROR]', txError);
        res.status(500).json({
          success: false,
          message: 'Erro ao criar veiculo (transação).',
          error: String(txError),
        } as ApiResponse<null>);
        return;
      } finally {
        conn.release();
      }
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao criar veiculo',
      } as ApiResponse<null>);
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const cleaned = normalizeCaminhaoPayload(req.body);
      const payload = AtualizarCaminhaoSchema.parse(cleaned as any);
      const carretaTypes = ['CARRETA', 'BITREM', 'RODOTREM'];

      // Normalizar valores vazios para null
      if ('placa_carreta' in payload && payload.placa_carreta === '') payload.placa_carreta = null as any;
      if ('ano_fabricacao' in payload && (payload as any).ano_fabricacao === '') payload.ano_fabricacao = null as any;
      if ('capacidade_toneladas' in payload && (payload as any).capacidade_toneladas === '') payload.capacidade_toneladas = null as any;

      // Se for alterar para um tipo que exige carreta, garantir que haja placa_carreta (ou já exista no banco)
      if (payload.tipo_veiculo && carretaTypes.includes(payload.tipo_veiculo)) {
        const needsPlaca = !('placa_carreta' in payload) || !payload.placa_carreta;
        if (needsPlaca) {
          const [rows] = await pool.execute('SELECT placa_carreta FROM frota WHERE id = ? LIMIT 1', [id]);
          const existing = rows as Array<{ placa_carreta: string | null }>;
          if (existing.length === 0 || !existing[0].placa_carreta) {
            res.status(400).json({
              success: false,
              message: 'Placa da carreta obrigatoria para o tipo de veiculo selecionado',
            } as ApiResponse<null>);
            return;
          }
        }
      }
      const { fields, values } = buildUpdate(payload as Record<string, unknown>, FROTA_FIELDS);

      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Nenhum campo valido para atualizar',
        } as ApiResponse<null>);
        return;
      }

      const sql = `UPDATE frota SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);
      const [result] = await pool.execute(sql, values);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Veiculo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      // Se foi associada um motorista, nada a limpar (placa_temporaria removida)
      if (payload.motorista_fixo_id) {
        // placeholder for future actions (e.g., audit)
      }

      res.json({
        success: true,
        message: 'Veiculo atualizado com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar veiculo',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    const connection = await pool.getConnection();
    try {
      const { id } = req.params;

      await connection.beginTransaction();

      const [veiRows] = await connection.execute(
        'SELECT id FROM frota WHERE id = ? LIMIT 1',
        [id]
      );
      if ((veiRows as unknown[]).length === 0) {
        await connection.rollback();
        res.status(404).json({
          success: false,
          message: 'Veiculo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      // Desassociar fretes que referenciam este veículo
      await connection.execute(
        'UPDATE fretes SET caminhao_id = NULL, caminhao_placa = NULL WHERE caminhao_id = ?',
        [id]
      );

      // Deletar o veículo
      await connection.execute('DELETE FROM frota WHERE id = ?', [id]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Veiculo removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        success: false,
        message: 'Erro ao remover veiculo',
      } as ApiResponse<null>);
    } finally {
      connection.release();
    }
  }
}
