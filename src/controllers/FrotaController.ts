import { Request, Response } from 'express';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { generateId } from '../utils/id';
import { buildUpdate } from '../utils/sql';
import { AtualizarCaminhaoSchema, CriarCaminhaoSchema } from '../utils/validators';
import { normalizeCaminhaoPayload } from '../utils/normalizeCaminhaoPayload';

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
        // support query ?vagos=1 to list only vehicles without a fixed driver
        if (_req.query.vagos === '1' || _req.query.vagos === 'true') {
          const sqlVagos = `SELECT id, placa, modelo, ano_fabricacao FROM frota WHERE motorista_fixo_id IS NULL`;
            const [rows] = await pool.execute(sqlVagos);
            res.json({ success: true, data: rows } as ApiResponse<unknown>);
            return;
        }

        const [rows] = await pool.execute('SELECT * FROM frota ORDER BY created_at DESC');
        res.json({
          success: true,
          message: 'Frota listada com sucesso',
          data: rows,
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
      const cleaned = normalizeCaminhaoPayload(req.body);
      const payload = CriarCaminhaoSchema.parse(cleaned as any);
      const carretaTypes = ['CARRETA', 'BITREM', 'RODOTREM'];

      // Se o tipo de veiculo exige carreta, placa_carreta é obrigatoria
      if (carretaTypes.includes(payload.tipo_veiculo) && !payload.placa_carreta) {
        res.status(400).json({
          success: false,
          message: 'Placa da carreta obrigatoria para o tipo de veiculo selecionado',
        } as ApiResponse<null>);
        return;
      }
      const id = payload.id || generateId('FROTA');
      const status = payload.status || 'disponivel';
      const tipoCombustivel = payload.tipo_combustivel || 'S10';
      const kmAtual = payload.km_atual ?? null;
      const proprietarioTipo = payload.proprietario_tipo || 'PROPRIO';

      await pool.execute(
        `INSERT INTO frota (
          id, placa, placa_carreta, modelo, ano_fabricacao, status, motorista_fixo_id,
          capacidade_toneladas, km_atual, tipo_combustivel, tipo_veiculo, renavam,
          renavam_carreta, chassi, registro_antt, validade_seguro, validade_licenciamento,
          proprietario_tipo, ultima_manutencao_data, proxima_manutencao_km
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          payload.placa,
          payload.placa_carreta ?? null,
          payload.modelo,
          payload.ano_fabricacao ?? null,
          status,
          payload.motorista_fixo_id || null,
          payload.capacidade_toneladas ?? null,
          kmAtual,
          tipoCombustivel,
          payload.tipo_veiculo,
          payload.renavam || null,
          payload.renavam_carreta || null,
          payload.chassi || null,
          payload.registro_antt || null,
          payload.validade_seguro || null,
          payload.validade_licenciamento || null,
          proprietarioTipo,
          payload.ultima_manutencao_data || null,
          payload.proxima_manutencao_km || null,
        ]
      );

      // Se veiculo estiver associado a um motorista, atualizamos relacionamento
      // nota: estratégia antiga de 'placa_temporaria' foi removida
      if (payload.motorista_fixo_id) {
        // Não é necessário limpar campo de placa temporária (removido do schema)
      }

      res.status(201).json({
        success: true,
        message: 'Veiculo criado com sucesso',
        data: { id },
      } as ApiResponse<{ id: string }>);
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
        message: 'Erro ao atualizar veiculo',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [result] = await pool.execute('DELETE FROM frota WHERE id = ?', [id]);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Veiculo nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Veiculo removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao remover veiculo',
      } as ApiResponse<null>);
    }
  }
}
