import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { generateId } from '../utils/id';
import { buildUpdate } from '../utils/sql';
import { AtualizarUsuarioSchema, CriarUsuarioAdminSchema } from '../utils/validators';

const USUARIO_FIELDS = [
  'nome',
  'email',
  'senha_hash',
  'role',
  'ativo',
  'telefone',
  'cpf',
  'ultimo_acesso',
  'tentativas_login_falhas',
  'bloqueado_ate',
  'token_recuperacao',
  'token_expiracao',
];

export class UsuarioController {
  async listar(_req: Request, res: Response): Promise<void> {
    try {
      const [rows] = await pool.execute(
        'SELECT id, nome, email, role, ativo, telefone, cpf, created_at, updated_at FROM usuarios ORDER BY created_at DESC'
      );
      res.json({
        success: true,
        message: 'Usuarios listados com sucesso',
        data: rows,
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao listar usuarios',
      } as ApiResponse<null>);
    }
  }

  async obterPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [rows] = await pool.execute(
        'SELECT id, nome, email, role, ativo, telefone, cpf, created_at, updated_at FROM usuarios WHERE id = ? LIMIT 1',
        [id]
      );

      const usuarios = rows as unknown[];
      if (usuarios.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Usuario nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Usuario carregado com sucesso',
        data: usuarios[0],
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao obter usuario',
      } as ApiResponse<null>);
    }
  }

  async criar(req: Request, res: Response): Promise<void> {
    try {
      const payload = CriarUsuarioAdminSchema.parse(req.body);

      let senhaHash = payload.senha_hash;
      if (!senhaHash && payload.senha) {
        senhaHash = await bcrypt.hash(payload.senha, 10);
      }

      // Higienização automática: Remove formatação antes de salvar
      const cpfLimpo = payload.cpf ? payload.cpf.replace(/\D/g, '') : null;
      const telefoneLimpo = payload.telefone ? payload.telefone.replace(/\D/g, '') : null;

      const id = payload.id || generateId('USR');
      const role = payload.role || 'operador';
      const ativo = payload.ativo !== undefined ? Boolean(payload.ativo) : true;

      await pool.execute(
        `INSERT INTO usuarios (
          id, nome, email, senha_hash, role, ativo, telefone, cpf
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          payload.nome,
          payload.email,
          senhaHash,
          role,
          ativo,
          telefoneLimpo,  // Telefone sem formatação
          cpfLimpo,       // CPF sem formatação
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Usuario criado com sucesso',
        data: { id },
      } as ApiResponse<{ id: string }>);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos. Verifique os campos preenchidos.',
          error: error.errors.map((err) => err.message).join('; '),
        } as ApiResponse<null>);
        return;
      }

      // Erro de email duplicado
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        const message = String(error).includes('email') 
          ? 'Este e-mail já está cadastrado no sistema.'
          : String(error).includes('cpf')
          ? 'Este CPF já está cadastrado no sistema.'
          : 'Dados duplicados. Verifique e-mail ou CPF.';
        
        res.status(409).json({
          success: false,
          message,
        } as ApiResponse<null>);
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao criar usuário. Tente novamente.',
      } as ApiResponse<null>);
    }
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payload = AtualizarUsuarioSchema.parse(req.body);

      if (payload.senha) {
        payload.senha_hash = await bcrypt.hash(payload.senha, 10);
      }

      const { fields, values } = buildUpdate(payload as Record<string, unknown>, USUARIO_FIELDS);
      if (fields.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Nenhum campo valido para atualizar',
        } as ApiResponse<null>);
        return;
      }

      const sql = `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);
      const [result] = await pool.execute(sql, values);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Usuario nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Usuario atualizado com sucesso',
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
        message: 'Erro ao atualizar usuario',
      } as ApiResponse<null>);
    }
  }

  async deletar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const [result] = await pool.execute('DELETE FROM usuarios WHERE id = ?', [id]);
      const info = result as { affectedRows: number };

      if (info.affectedRows === 0) {
        res.status(404).json({
          success: false,
          message: 'Usuario nao encontrado',
        } as ApiResponse<null>);
        return;
      }

      res.json({
        success: true,
        message: 'Usuario removido com sucesso',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao remover usuario',
      } as ApiResponse<null>);
    }
  }
}
