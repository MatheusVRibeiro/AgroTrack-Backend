import express, { Express, Request, Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middlewares/errorHandler';
import { securityHeaders } from './middlewares/securityHeaders';
import { loginLimiter, defaultLimiter } from './middlewares/rateLimiter';
import pool from './database/connection';
import { isCacheReady } from './utils/cache';
import { startInactivityJob, stopInactivityJob } from './jobs/inactivityJob';

// Importar rotas
import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import freteRoutes from './routes/freteRoutes';
import usuarioRoutes from './routes/usuarioRoutes';
import motoristaRoutes from './routes/motoristaRoutes';
import frotaRoutes from './routes/frotaRoutes';
import fazendaRoutes from './routes/fazendaRoutes';
import custoRoutes from './routes/custoRoutes';
import pagamentoRoutes from './routes/pagamentoRoutes';
import { AuthController } from './controllers';

// Carregar variáveis de ambiente
dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ==================== MIDDLEWARES ====================

// Security headers (antes de qualquer resposta)
app.use(securityHeaders);

// CORS - Configuração simplificada para produção e desenvolvimento
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  'http://localhost:3000',        // Painel Web
  'http://localhost:8081',        // Expo Web (React Native)
  'http://localhost:5173',        // Vite default
  'http://localhost:8080',        // Vite custom
  'http://192.168.0.174:8081',    // Expo Web na rede local
  'http://192.168.0.174:19006',   // Expo Dev Server alternativo
  frontendUrl,                    // URL do Frontend (do .env)
  // Produção
  'https://caramellologistica.com',
  'https://www.caramellologistica.com',
  'https://api.caramellologistica.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (mobile apps, Postman, etc)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Em desenvolvimento, permitir todas as origens localhost
        if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168'))) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true, // Necessário para cookies HttpOnly
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 204,
  })
);

app.use((_req: Request, res: Response, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Garantir resposta para preflight em todas as rotas
app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    return allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// Cookie parser (necessário para ler cookies HttpOnly)
app.use(cookieParser());

// Body Parser
app.use(compression());
app.use(express.json({ limit: '1mb' })); // Limitar tamanho do body
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Logger estruturado
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(
  pinoHttp({
    logger,
    genReqId: (_req: Request) => randomUUID(),
  })
);

// ==================== ROTAS ====================

// Rota raiz
app.get('/', (_req: Request, res: Response) => {
  res.send('Hello World');
});

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Backend está funcionando',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/full', async (_req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    await pool.execute('SELECT 1');
    res.json({
      success: true,
      message: 'Healthcheck completo ok',
      data: {
        uptime: process.uptime(),
        db: 'ok',
        cache: isCacheReady() ? 'ok' : 'disabled',
        responseTimeMs: Date.now() - startedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      message: 'Healthcheck completo com falha',
      data: {
        uptime: process.uptime(),
        db: 'error',
        cache: isCacheReady() ? 'ok' : 'disabled',
        responseTimeMs: Date.now() - startedAt,
      },
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await pool.execute('SELECT 1');
    res.json({
      success: true,
      message: 'Banco de dados conectado',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      message: 'Banco de dados indisponível',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// Rotas de conveniência (com rate limiting!)
const authController = new AuthController();
app.get('/login', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Use POST /login or POST /auth/login to authenticate' });
});
app.post('/login', loginLimiter, (req: Request, res: Response) => authController.login(req, res));
app.post('/registrar', defaultLimiter, (req: Request, res: Response) => authController.registrar(req, res));

// Rotas de recuperação de senha (conveniência - com rate limiting)
app.post('/recuperar-senha', defaultLimiter, (req: Request, res: Response) => authController.forgotPassword(req, res));
app.post('/redefinir-senha', defaultLimiter, (req: Request, res: Response) => authController.resetPassword(req, res));

// Auth routes (mounted at /auth if needed)
app.use('/auth', authRoutes);

// Primary app routes (base paths)
app.use('/dashboard', dashboardRoutes);
app.use('/fretes', freteRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/motoristas', motoristaRoutes);
app.use('/frota', frotaRoutes);
app.use('/fazendas', fazendaRoutes);
app.use('/custos', custoRoutes);
app.use('/pagamentos', pagamentoRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.path,
  });
});

// Error Handler
app.use(errorHandler);

// ==================== CONEXÃO E INICIALIZAÇÃO ====================

const startServer = async () => {
  try {
    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔒 Security: HttpOnly Cookies + RBAC + Rate Limiting ativo`);

      // Iniciar job de inativação automática por inatividade
      startInactivityJob();
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  stopInactivityJob();
  process.exit(0);
});

startServer();

export default app;
