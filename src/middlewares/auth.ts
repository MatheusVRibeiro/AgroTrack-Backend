import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'seu_secret_key_aqui';

export type UserRole = 'admin' | 'contabilidade' | 'operador' | 'motorista';

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Middleware de autenticação.
 * 
 * Aceita token de duas formas (em ordem de prioridade):
 * 1. Cookie HttpOnly `accessToken` (mais seguro — imune a XSS)
 * 2. Header `Authorization: Bearer <token>` (compatibilidade com mobile/Postman)
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Tentar ler do cookie HttpOnly primeiro (mais seguro)
    let token = req.cookies?.accessToken;

    // 2. Fallback: header Authorization (mobile apps, Postman)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token não fornecido',
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      req.userId = decoded.id;

      let userRole: UserRole = decoded.role;

      // Token antigo sem role → buscar no banco para não rebaixar admins logados antes do update
      if (!userRole) {
        try {
          const pool = (await import('../database/connection')).default;
          const [rows] = await pool.execute(
            'SELECT role FROM usuarios WHERE id = ? LIMIT 1',
            [decoded.id]
          );
          const users = rows as Array<{ role: UserRole }>;
          userRole = users[0]?.role || 'operador';
        } catch {
          userRole = 'operador';
        }
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: userRole,
      };
      next();
    } catch (error) {
      // Se o token do cookie expirou, limpar o cookie
      if (req.cookies?.accessToken) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
      }
      res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao validar token',
    });
  }
};

/**
 * Gera um JWT com role incluída no payload.
 */
export const generateToken = (id: string, email: string, role: UserRole = 'operador'): string => {
  return jwt.sign(
    { id, email, role },
    JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    } as any
  );
};

/**
 * Gera um refresh token de longa duração.
 */
export const generateRefreshToken = (id: string, email: string, role: UserRole = 'operador'): string => {
  return jwt.sign(
    { id, email, role, type: 'refresh' },
    JWT_SECRET,
    {
      expiresIn: '30d',
    } as any
  );
};

// ─── Cookie helpers ──────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Configura os cookies HttpOnly de autenticação na resposta.
 */
export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  // Access token: curta duração (mesmo tempo do JWT)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,        // Inacessível via JavaScript
    secure: isProduction,  // Apenas HTTPS em produção
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias (match JWT_EXPIRES_IN)
    path: '/',
  });

  // Refresh token: longa duração
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
    path: '/auth/refresh',  // Restrito apenas à rota de refresh
  });
};

/**
 * Limpa os cookies de autenticação.
 */
export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/auth/refresh' });
};
