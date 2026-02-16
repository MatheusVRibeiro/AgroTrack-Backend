import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middlewares/errorHandler';

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

// CORS - Configuração simplificada para produção e desenvolvimento
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  'http://localhost:3000',        // Painel Web
  'http://localhost:8081',        // Expo Web (React Native)
  'http://localhost:5173',        // Vite default
  'http://192.168.0.174:8081',    // Expo Web na rede local
  'http://192.168.0.174:19006',   // Expo Dev Server alternativo
  frontendUrl,                    // URL do Frontend (do .env)
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log('🌐 [CORS] Request from origin:', origin);
      
      // Permitir requisições sem origin (mobile apps, Postman, etc)
      if (!origin) {
        console.log('✅ [CORS] No origin - permitido');
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        console.log('✅ [CORS] Origin permitida:', origin);
        callback(null, true);
      } else {
        console.log('❌ [CORS] Origin bloqueada:', origin);
        // Em desenvolvimento, permitir todas as origens localhost
        if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168'))) {
          console.log('⚠️ [CORS] Permitindo localhost/rede local em dev:', origin);
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 200,
  })
);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Logger
app.use(morgan('combined'));

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

// Rotas (sem /api prefix) — rotas simples e conveniência
// Conveniência: atalhos públicos para usar com formulários simples
const authController = new AuthController();
app.get('/login', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Use POST /login or POST /auth/login to authenticate' });
});
app.post('/login', (req: Request, res: Response) => authController.login(req, res));
app.post('/registrar', (req: Request, res: Response) => authController.registrar(req, res));

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
// Nota: `locaisEntrega` não está disponível no schema atual, rota não registrada

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
      console.log(`🌐 Acessível em http://192.168.0.174:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  process.exit(0);
});

startServer();

export default app;
