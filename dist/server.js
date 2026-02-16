"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./middlewares/errorHandler");
// Importar rotas
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const freteRoutes_1 = __importDefault(require("./routes/freteRoutes"));
const usuarioRoutes_1 = __importDefault(require("./routes/usuarioRoutes"));
const motoristaRoutes_1 = __importDefault(require("./routes/motoristaRoutes"));
const frotaRoutes_1 = __importDefault(require("./routes/frotaRoutes"));
const fazendaRoutes_1 = __importDefault(require("./routes/fazendaRoutes"));
const custoRoutes_1 = __importDefault(require("./routes/custoRoutes"));
const pagamentoRoutes_1 = __importDefault(require("./routes/pagamentoRoutes"));
const controllers_1 = require("./controllers");
// Carregar variáveis de ambiente
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// ==================== MIDDLEWARES ====================
// CORS - Configuração simplificada para produção e desenvolvimento
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [
    'http://localhost:3000', // Painel Web
    'http://localhost:8081', // Expo Web (React Native)
    'http://localhost:5173', // Vite default
    'http://192.168.0.174:8081', // Expo Web na rede local
    'http://192.168.0.174:19006', // Expo Dev Server alternativo
    'https://caramellologistica.com', // <- Adicione o seu domínio oficial
    'https://www.caramellologistica.com', // <- Adicione com 'www' por precaução
    // 'https://agrotrack-frontend-ep3b.onrender.com', // Frontend no Render (URL correta)
    frontendUrl, // URL do Frontend (do .env)
];
app.use((0, cors_1.default)({
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
        }
        else {
            console.log('❌ [CORS] Origin bloqueada:', origin);
            // Em desenvolvimento, permitir todas as origens localhost
            if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168'))) {
                console.log('⚠️ [CORS] Permitindo localhost/rede local em dev:', origin);
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 200,
}));
// Body Parser
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Servir arquivos estáticos (uploads)
app.use('/uploads', express_1.default.static(path_1.default.resolve(__dirname, '../uploads')));
// Logger
app.use((0, morgan_1.default)('combined'));
// ==================== ROTAS ====================
// Rota raiz
app.get('/', (_req, res) => {
    res.send('Hello World');
});
// Health Check
app.get('/health', (_req, res) => {
    res.json({
        success: true,
        message: 'Backend está funcionando',
        timestamp: new Date().toISOString(),
    });
});
// Rotas (sem /api prefix) — rotas simples e conveniência
// Conveniência: atalhos públicos para usar com formulários simples
const authController = new controllers_1.AuthController();
app.get('/login', (_req, res) => {
    res.json({ success: true, message: 'Use POST /login or POST /auth/login to authenticate' });
});
app.post('/login', (req, res) => authController.login(req, res));
app.post('/registrar', (req, res) => authController.registrar(req, res));
// Auth routes (mounted at /auth if needed)
app.use('/auth', authRoutes_1.default);
// Primary app routes (base paths)
app.use('/dashboard', dashboardRoutes_1.default);
app.use('/fretes', freteRoutes_1.default);
app.use('/usuarios', usuarioRoutes_1.default);
app.use('/motoristas', motoristaRoutes_1.default);
app.use('/frota', frotaRoutes_1.default);
app.use('/fazendas', fazendaRoutes_1.default);
app.use('/custos', custoRoutes_1.default);
app.use('/pagamentos', pagamentoRoutes_1.default);
// Nota: `locaisEntrega` não está disponível no schema atual, rota não registrada
// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada',
        path: req.path,
    });
});
// Error Handler
app.use(errorHandler_1.errorHandler);
// ==================== CONEXÃO E INICIALIZAÇÃO ====================
const startServer = async () => {
    try {
        // Iniciar servidor
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
            console.log(`🌐 Acessível em http://192.168.0.174:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });
    }
    catch (error) {
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
exports.default = app;
//# sourceMappingURL=server.js.map