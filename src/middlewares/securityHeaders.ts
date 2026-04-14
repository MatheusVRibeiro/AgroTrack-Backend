import { Request, Response, NextFunction } from 'express';

/**
 * Middleware que adiciona headers de segurança HTTP em todas as respostas.
 *
 * Equivalente a um "helmet" leve e customizado para a API.
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Previne que o navegador tente adivinhar o Content-Type (MIME sniffing)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Bloqueia o carregamento da API em iframes de outros sites (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // Ativa a proteção XSS do navegador (legada, mas não custa)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Controla o que é enviado no header Referer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Desabilita features desnecessárias do navegador
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // Força HTTPS em produção via HSTS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Remove o header que revela a tecnologia do servidor
  res.removeHeader('X-Powered-By');

  next();
};
