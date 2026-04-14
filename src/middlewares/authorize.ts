import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { UserRole } from './auth';

/**
 * Middleware de autorização por role (RBAC).
 *
 * Deve ser usado APÓS o `authMiddleware`, que já popula `req.user`.
 *
 * Uso nas rotas:
 *   router.delete('/:id', requireRole('admin'), handler);
 *   router.post('/', requireRole('admin', 'operador'), handler);
 *   router.get('/', requireRole('admin', 'contabilidade', 'operador'), handler);
 *
 * Hierarquia de permissões (sugestão para rotas):
 *   admin         → tudo (CRUD completo + deletar + gerenciar users)
 *   contabilidade → leitura + criar/editar pagamentos
 *   operador      → leitura + criar/editar fretes, custos, motoristas, fazendas, frota
 *   motorista     → apenas leitura dos próprios dados
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Não autenticado',
      });
      return;
    }

    const userRole = user.role || 'operador';

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não tem permissão para esta operação.',
        requiredRoles: allowedRoles,
        currentRole: userRole,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware que permite apenas administradores.
 * Atalho para requireRole('admin').
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware que permite admins e contabilidade.
 * Usado para operações financeiras (pagamentos).
 */
export const requireFinanceiro = requireRole('admin', 'contabilidade');

/**
 * Middleware que permite admins e operadores.
 * Usado para operações de cadastro (fretes, motoristas, etc.).
 */
export const requireOperacional = requireRole('admin', 'operador');

/**
 * Middleware que permite qualquer usuário autenticado com papel de gestão.
 * Exclui motoristas de acessar endpoints administrativos.
 */
export const requireGestao = requireRole('admin', 'contabilidade', 'operador');
