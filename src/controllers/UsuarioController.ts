import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../database/connection';
import { ApiResponse } from '../types';
import { buildUpdate, getPagination } from '../utils/sql';
import { AtualizarUsuarioSchema, CriarUsuarioAdminSchema, sanitizarDocumento } from '../utils/validators';
import { sendValidationError } from '../utils/validation';

const USUARIO_FIELDS = [
  'nome',
  'email',
  'senha_hash',
  'role',
  'ativo',
  'telefone',
  'documento',
  'ultimo_acesso',
  'tentativas_login_falhas',
  'bloqueado_ate',
  'token_recuperacao',
  'token_expiracao',
];

export class UsuarioController {
  async listar(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, offset } = getPagination(req.query as Record<string, unknown>);
      const [rowsResult, countResult] = await Promise.all([
        pool.execute(
          `SELECT id, codigo_usuario, nome, email, role, ativo, telefone, documento, ultimo_acesso, bloqueado_ate, tentativas_login_falhas, created_at, updated_at FROM usuarios ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
        ),
        pool.execute('SELECT COUNT(*) as total FROM usuarios'),
      ]);
      const rows = rowsResult[0];
      const total = (countResult[0] as Array<{ total: number }>)[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      res.json({
        success: true,
        message: 'Usuarios listados com sucesso',
        data: rows,
        meta: { page, limit, total, totalPages },
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
        'SELECT id, codigo_usuario, nome, email, role, ativo, telefone, documento, ultimo_acesso, bloqueado_ate, tentativas_login_falhas, created_at, updated_at FROM usuarios WHERE id = ? LIMIT 1',
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
      const documentoLimpo = payload.documento ? sanitizarDocumento(String(payload.documento)) : null;
      const telefoneLimpo = payload.telefone ? payload.telefone.replace(/\D/g, '') : null;

      const role = payload.role || 'operador';
      const ativo = payload.ativo !== undefined ? Boolean(payload.ativo) : true;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // 1. INSERT sem ID manual
        const insertSql = `INSERT INTO usuarios (
          nome, email, senha_hash, role, ativo, telefone, documento
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const insertParams = [
          payload.nome,
          payload.email,
          senhaHash,
          role,
          ativo,
          telefoneLimpo,
          documentoLimpo
        ];
        const [result]: any = await conn.execute(insertSql, insertParams);
        const insertId = result.insertId;

        // 2. Geração da sigla/código
        const ano = new Date().getFullYear();
        const codigo = `USR-${ano}-${String(insertId).padStart(3, '0')}`;
        await conn.execute('UPDATE usuarios SET codigo_usuario = ? WHERE id = ?', [codigo, insertId]);

        await conn.commit();

        res.status(201).json({
          success: true,
          message: 'Usuario criado com sucesso',
          data: { id: codigo },
        } as ApiResponse<{ id: string }>);
        return;
      } catch (txError) {
        await conn.rollback();
        res.status(500).json({
          success: false,
          message: 'Erro ao criar usuário (transação).',
        } as ApiResponse<null>);
        return;
      } finally {
        conn.release();
      }
    } catch (error) {
      if (sendValidationError(res, error, 'Dados inválidos. Verifique os campos preenchidos.')) {
        return;
      }

      // Erro de email duplicado
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        const message = String(error).includes('email') 
          ? 'Este e-mail já está cadastrado no sistema.'
          : String(error).includes('documento')
          ? 'Este documento já está cadastrado no sistema.'
          : 'Dados duplicados. Verifique e-mail ou documento.';
        
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
      if (sendValidationError(res, error)) {
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
