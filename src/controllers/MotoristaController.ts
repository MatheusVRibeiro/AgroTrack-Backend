import { Request, Response } from 'express';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { generateId } from '../utils/id';
import { buildUpdate } from '../utils/sql';
import { AtualizarMotoristaSchemaWithVinculo, CriarMotoristaSchemaWithVinculo } from '../utils/validators';

const MOTORISTA_FIELDS = [
  'id',
  'nome',
  'cpf',
  'telefone',
  'email',
  'endereco',
  'cnh',
  'cnh_validade',
  'cnh_categoria',
  'status',
  'tipo',
  'data_admissao',
  'data_desligamento',
  'tipo_pagamento',
  'chave_pix_tipo',
  'chave_pix',
  'banco',
  'agencia',
  'conta',
  'tipo_conta',
  'receita_gerada',
  'viagens_realizadas',
  'caminhao_atual',
];
export class MotoristaController {
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
      // Normalize empty strings to null for optional fields coming from the frontend
      const cleanedRequest: any = { ...req.body };
      ['email', 'banco', 'agencia', 'conta', 'chave_pix', 'cnh', 'cnh_validade', 'cnh_categoria', 'cpf', 'tipo_conta', 'endereco']
        .forEach((k) => {
          if (k in cleanedRequest && cleanedRequest[k] === '') cleanedRequest[k] = null;
        });

      const payload = CriarMotoristaSchemaWithVinculo.parse(cleanedRequest) as any;

      // Higienização: proteções para campos opcionais
      const cpfLimpo = payload.cpf ? String(payload.cpf).replace(/\D/g, '') : null;
      const cnhLimpa = payload.cnh ? String(payload.cnh).replace(/\D/g, '') : null;
      const telefoneLimpo = payload.telefone ? String(payload.telefone).replace(/\D/g, '') : null;
      const chavePixLimpa = payload.chave_pix ? String(payload.chave_pix).replace(/\D/g, '') : null;

      const id = payload.id || generateId('MOT');

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const sql = `INSERT INTO motoristas (
          id, nome, cpf, telefone, email, endereco, cnh, cnh_validade, cnh_categoria,
          status, tipo, data_admissao, data_desligamento, tipo_pagamento, chave_pix_tipo,
          chave_pix, banco, agencia, conta, tipo_conta, receita_gerada, viagens_realizadas,
          caminhao_atual
        ) VALUES (${new Array(23).fill('?').join(',')})`;

        const dadosMotorista: any = {
          nome: payload.nome,
          cpf: cpfLimpo,
          telefone: telefoneLimpo,
          email: payload.email || null,
          endereco: payload.endereco || null,
          cnh: cnhLimpa,
          cnh_validade: payload.cnh_validade || null,
          cnh_categoria: payload.cnh_categoria || null,
          status: payload.status || 'ativo',
          tipo: payload.tipo,
          data_admissao: payload.data_admissao || null,
          data_desligamento: payload.data_desligamento || null,
          tipo_pagamento: payload.tipo_pagamento || null,
          chave_pix_tipo: payload.chave_pix_tipo || null,
          chave_pix: chavePixLimpa || null,
          banco: payload.banco || null,
          agencia: payload.agencia || null,
          conta: payload.conta || null,
          tipo_conta: payload.tipo_conta || null,
          receita_gerada: payload.receita_gerada || 0,
          viagens_realizadas: payload.viagens_realizadas || 0,
          caminhao_atual: payload.caminhao_atual || null,
        };

        const values = [
          id,
          dadosMotorista.nome,
          dadosMotorista.cpf,
          dadosMotorista.telefone,
          dadosMotorista.email,
          dadosMotorista.endereco,
          dadosMotorista.cnh,
          dadosMotorista.cnh_validade,
          dadosMotorista.cnh_categoria,
          dadosMotorista.status,
          dadosMotorista.tipo,
          dadosMotorista.data_admissao,
          dadosMotorista.data_desligamento,
          dadosMotorista.tipo_pagamento,
          dadosMotorista.chave_pix_tipo,
          dadosMotorista.chave_pix,
          dadosMotorista.banco,
          dadosMotorista.agencia,
          dadosMotorista.conta,
          dadosMotorista.tipo_conta,
          dadosMotorista.receita_gerada,
          dadosMotorista.viagens_realizadas,
          dadosMotorista.caminhao_atual,
        ];

        await connection.execute(sql, values);

        // Vincula ao veículo se informado e aplicável
        if (payload.veiculo_id && ['terceirizado', 'agregado'].includes(payload.tipo)) {
          const [rows] = await connection.execute('SELECT id FROM frota WHERE id = ?', [payload.veiculo_id]) as any;
          if (!rows || rows.length === 0) {
            await connection.rollback();
            connection.release();
            res.status(400).json({ success: false, message: 'Veículo informado não existe' });
            return;
          }

          await connection.execute('UPDATE frota SET motorista_fixo_id = ? WHERE id = ?', [id, payload.veiculo_id]);
        }

        await connection.commit();
        connection.release();

        res.status(201).json({
          success: true,
          message: 'Motorista criado com sucesso',
          data: { id },
        } as ApiResponse<{ id: string }>);
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos. Verifique os campos preenchidos.',
          error: error.errors.map((err) => err.message).join('; '),
        } as ApiResponse<null>);
        return;
      }

      // Erro de CPF/CNH duplicado
      if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'ER_DUP_ENTRY') {
        const msg = String(error).includes('cpf')
          ? 'Este CPF já está cadastrado no sistema.'
          : String(error).includes('cnh')
          ? 'Esta CNH já está cadastrada no sistema.'
          : 'Dados duplicados. Verifique CPF ou CNH.';

        res.status(409).json({ success: false, message: msg } as ApiResponse<null>);
        return;
      }

      res.status(500).json({ success: false, message: 'Erro ao criar motorista. Tente novamente.' } as ApiResponse<null>);
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
        // Normalize empty strings to null for update payloads
        const cleanedRequest: any = { ...req.body };
        ['email', 'banco', 'agencia', 'conta', 'chave_pix', 'cnh', 'cnh_validade', 'cnh_categoria', 'cpf', 'tipo_conta', 'endereco']
          .forEach((k) => {
            if (k in cleanedRequest && cleanedRequest[k] === '') cleanedRequest[k] = null;
          });

        const payload = AtualizarMotoristaSchemaWithVinculo.parse(cleanedRequest) as any;

      // Regra de negocio: antiga lógica com 'placa_temporaria' removida do schema
      // Se necessário, utilizar `veiculo_id` / `motorista_fixo_id` para vínculo.

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
