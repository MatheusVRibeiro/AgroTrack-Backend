import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import pool from '../database/connection';
import { generateToken, generateRefreshToken, setAuthCookies, clearAuthCookies } from '../middlewares/auth';
import { CriarUsuarioSchema, LoginSchema } from '../utils/validators';
import { sendValidationError } from '../utils/validation';
import { sendResetPasswordEmail, sendPasswordResetSuccessEmail } from '../services/EmailService';
import { ApiResponse } from '../types';
import { sanitizeEmail, sanitizeText, sanitizePayload } from '../utils/sanitize';
import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from '../middlewares/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'seu_secret_key_aqui';

export class AuthController {
  async registrar(req: Request, res: Response): Promise<void> {
    try {
      // Sanitizar body antes da validação
      const sanitizedBody = sanitizePayload(req.body as Record<string, unknown>);
      const data = CriarUsuarioSchema.parse(sanitizedBody);

      const [existingRows] = await pool.execute(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        [data.email]
      );

      const existing = existingRows as { id: string }[];
      
      if (existing.length > 0) {
        res.status(409).json({
          success: false,
          message: 'Email ja cadastrado',
        } as ApiResponse<null>);
        return;
      }

      const senhaHash = await bcrypt.hash(data.senha, 12); // Aumentado de 10 para 12 rounds
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const insertSql = `INSERT INTO usuarios (
          nome, email, senha_hash, role, ativo
        ) VALUES (?, ?, ?, ?, ?)`;
        const insertParams = [
          sanitizeText(data.nome, 200),
          sanitizeEmail(data.email),
          senhaHash,
          'operador',
          true
        ];
        const [result]: any = await conn.execute(insertSql, insertParams);
        const insertId = result.insertId;

        const ano = new Date().getFullYear();
        const codigo = `USR-${ano}-${String(insertId).padStart(3, '0')}`;
        await conn.execute('UPDATE usuarios SET codigo_usuario = ? WHERE id = ?', [codigo, insertId]);

        await conn.commit();

        res.status(201).json({
          success: true,
          id: codigo
        });
        return;
      } catch (txError) {
        await conn.rollback();
        res.status(500).json({
          success: false,
          message: 'Erro ao registrar usuário (transação).'
        });
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
        message: 'Erro ao registrar usuario',
      } as ApiResponse<null>);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const data = LoginSchema.parse(req.body);

      // Sanitizar o email
      const email = sanitizeEmail(data.email);

      const [rows] = await pool.execute(
        'SELECT id, nome, email, senha_hash, role, tentativas_login_falhas, bloqueado_ate, ativo FROM usuarios WHERE email = ? LIMIT 1',
        [email]
      );

      const users = rows as Array<{ 
        id: string;
        nome: string;
        email: string;
        senha_hash: string;
        role: UserRole;
        tentativas_login_falhas: number;
        bloqueado_ate: Date | null;
        ativo?: number;
      }>;
      
      if (users.length === 0) {
        res.status(401).json({
          success: false,
          message: 'Credenciais invalidas',
        } as ApiResponse<null>);
        return;
      }

      const user = users[0];
      if (!user || !user.senha_hash) {
        res.status(401).json({
          success: false,
          message: 'Credenciais invalidas',
        } as ApiResponse<null>);
        return;
      }

      // Rejeitar usuários inativos
      if ('ativo' in user && user.ativo === 0) {
        res.status(403).json({ success: false, message: 'Conta inativa' } as ApiResponse<null>);
        return;
      }
      
      // Verificar se está bloqueado
      if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
        const minutosRestantes = Math.ceil((new Date(user.bloqueado_ate).getTime() - Date.now()) / 60000);
        res.status(403).json({
          success: false,
          message: `Conta bloqueada. Tente novamente em ${minutosRestantes} minuto(s).`,
        } as ApiResponse<null>);
        return;
      }
      
      let valid = false;
      try {
        valid = await bcrypt.compare(data.senha, user.senha_hash);
      } catch (cmpErr) {
        valid = false;
      }

      if (!valid) {
        // Incrementar tentativas
        const novasTentativas = user.tentativas_login_falhas + 1;
        
        // Bloquear se atingir 8 tentativas
        if (novasTentativas >= 8) {
          await pool.execute(
            'UPDATE usuarios SET tentativas_login_falhas = ?, bloqueado_ate = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
            [novasTentativas, user.id]
          );
          res.status(403).json({
            success: false,
            message: 'Conta bloqueada por 15 minutos devido a múltiplas tentativas falhas.',
          } as ApiResponse<null>);
          return;
        } else {
          await pool.execute(
            'UPDATE usuarios SET tentativas_login_falhas = ? WHERE id = ?',
            [novasTentativas, user.id]
          );
          const tentativasRestantes = 8 - novasTentativas;
          res.status(401).json({
            success: false,
            message: `Credenciais inválidas. ${tentativasRestantes} tentativa(s) restante(s).`,
          } as ApiResponse<null>);
          return;
        }
      }

      // Role do usuário (fallback para 'admin' se campo não existe no banco)
      const userRole: UserRole = user.role || 'admin';

      // Gerar tokens com role incluída
      const token = generateToken(user.id, user.email, userRole);
      const refreshToken = generateRefreshToken(user.id, user.email, userRole);
      
      // Resetar tentativas de login e remover bloqueio
      await pool.execute(
        'UPDATE usuarios SET tentativas_login_falhas = 0, bloqueado_ate = NULL, ultimo_acesso = NOW() WHERE id = ?',
        [user.id]
      );

      // Configurar cookies HttpOnly
      setAuthCookies(res, token, refreshToken);

      // Também retornar tokens no body para compatibilidade com mobile/frontend atual
      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        token,
        refreshToken,
        usuario: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: userRole,
        },
      });
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao realizar login',
      } as ApiResponse<null>);
    }
  }

  /**
   * Refresh token — renova o access token usando o refresh token.
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      // Tentar ler refresh token do cookie ou do body
      const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshTokenValue) {
        res.status(401).json({
          success: false,
          message: 'Refresh token não fornecido',
        } as ApiResponse<null>);
        return;
      }

      try {
        const decoded = jwt.verify(refreshTokenValue, JWT_SECRET) as JwtPayload & { type?: string };

        if (decoded.type !== 'refresh') {
          res.status(401).json({
            success: false,
            message: 'Token inválido (não é um refresh token)',
          } as ApiResponse<null>);
          return;
        }

        // Verificar se o usuário ainda existe e está ativo
        const [rows] = await pool.execute(
          'SELECT id, email, role, ativo FROM usuarios WHERE id = ? LIMIT 1',
          [decoded.id]
        );
        const users = rows as Array<{ id: string; email: string; role: UserRole; ativo?: number }>;
        
        if (users.length === 0 || users[0].ativo === 0) {
          clearAuthCookies(res);
          res.status(401).json({
            success: false,
            message: 'Sessão expirada',
          } as ApiResponse<null>);
          return;
        }

        const user = users[0];
        const userRole: UserRole = user.role || 'admin';

        // Gerar novo access token
        const newToken = generateToken(user.id, user.email, userRole);
        const newRefreshToken = generateRefreshToken(user.id, user.email, userRole);

        // Atualizar cookies
        setAuthCookies(res, newToken, newRefreshToken);

        res.json({
          success: true,
          message: 'Token renovado com sucesso',
          token: newToken,
          refreshToken: newRefreshToken,
        });
      } catch (jwtError) {
        clearAuthCookies(res);
        res.status(401).json({
          success: false,
          message: 'Refresh token expirado ou inválido',
        } as ApiResponse<null>);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao renovar sessão',
      } as ApiResponse<null>);
    }
  }

  /**
   * Logout — limpa cookies de autenticação.
   */
  async logout(_req: Request, res: Response): Promise<void> {
    clearAuthCookies(res);
    res.json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  }

  /**
   * Solicitar recuperação de senha via email
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Email é obrigatório',
        } as ApiResponse<null>);
        return;
      }

      // Sanitizar email
      const cleanEmail = sanitizeEmail(email);

      const [rows] = await pool.execute('SELECT id, nome, email FROM usuarios WHERE email = ? LIMIT 1', [cleanEmail]);
      const usuarios = rows as Array<{ id: number; nome: string; email: string }>;

      if (usuarios.length === 0) {
        // Por segurança, não revelar se o email existe ou não
        res.json({
          success: true,
          message: 'Se o email estiver registrado, você receberá um link de recuperação em breve.',
        } as ApiResponse<null>);
        return;
      }

      const usuario = usuarios[0];

      // Gerar token de recuperação (40 caracteres randômicos em hexadecimal)
      const tokenRecuperacao = randomBytes(20).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      // Armazenar token no banco
      await pool.execute(
        `UPDATE usuarios 
         SET token_recuperacao = ?, token_expiracao = ?
         WHERE id = ?`,
        [tokenRecuperacao, tokenExpiresAt, usuario.id]
      );

      // Enviar email
      try {
        await sendResetPasswordEmail(usuario.email, tokenRecuperacao, usuario.nome);
      } catch (emailError) {
        // Mesmo com erro de email, responder que enviamos
      }

      res.json({
        success: true,
        message: 'Se o email estiver registrado, você receberá um link de recuperação em breve.',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao processar recuperação de senha',
      } as ApiResponse<null>);
    }
  }

  /**
   * Redefinir senha com token de recuperação
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, novaSenha, confirmaSenha } = req.body;

      if (!token || !novaSenha || !confirmaSenha) {
        res.status(400).json({
          success: false,
          message: 'Token, nova senha e confirmação são obrigatórios',
        } as ApiResponse<null>);
        return;
      }

      if (novaSenha !== confirmaSenha) {
        res.status(400).json({
          success: false,
          message: 'As senhas não conferem',
        } as ApiResponse<null>);
        return;
      }

      if (novaSenha.length < 6) {
        res.status(400).json({
          success: false,
          message: 'A senha deve ter pelo menos 6 caracteres',
        } as ApiResponse<null>);
        return;
      }

      // Sanitizar o token para evitar injeção
      const cleanToken = sanitizeText(token, 100);

      const [rows] = await pool.execute(
        `SELECT id, nome, email FROM usuarios 
         WHERE token_recuperacao = ? 
         AND token_expiracao > NOW()
         LIMIT 1`,
        [cleanToken]
      );

      const usuarios = rows as Array<{ id: number; nome: string; email: string }>;

      if (usuarios.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Token inválido ou expirado. Solicite uma nova recuperação.',
        } as ApiResponse<null>);
        return;
      }

      const usuario = usuarios[0];

      const senhaHash = await bcrypt.hash(novaSenha, 12);

      await pool.execute(
        `UPDATE usuarios 
         SET senha_hash = ?, token_recuperacao = NULL, token_expiracao = NULL
         WHERE id = ?`,
        [senhaHash, usuario.id]
      );

      // Enviar email de confirmação
      try {
        await sendPasswordResetSuccessEmail(usuario.email, usuario.nome);
      } catch (emailError) {
        // Continuar mesmo se falhar
      }

      res.json({
        success: true,
        message: 'Senha redefinida com sucesso. Você pode fazer login agora.',
      } as ApiResponse<null>);
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro ao redefinir senha',
      } as ApiResponse<null>);
    }
  }
}
