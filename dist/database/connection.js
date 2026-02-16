"use strict";
// ======================================================
// 📦 Arquivo: database/connection.ts
// 🔧 Configuração da conexão MySQL (compatível com AWS RDS)
// ======================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const promise_1 = __importDefault(require("mysql2/promise"));
dotenv_1.default.config();
// ======================================================
// ⚙️ CRIA O POOL DE CONEXÕES
// ======================================================
const pool = promise_1.default.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'logistica_db',
    waitForConnections: true,
    connectionLimit: 10, // número máximo de conexões simultâneas
    queueLimit: 0,
    connectTimeout: 10000, // evita travamento se o banco não responder
});
// ======================================================
// 🧪 TESTE DE CONEXÃO (executado apenas uma vez)
// ======================================================
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅ Conexão MySQL (AWS RDS) estabelecida com sucesso!');
        conn.release();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Falha ao conectar ao MySQL (AWS RDS):', errorMessage);
        console.error('🔹 Verifique se a porta 3306 está liberada na AWS.');
        console.error('🔹 Confirme usuário e senha no arquivo .env.');
        console.error('🔹 Confira se o banco "logistica_db" está acessível.');
    }
})();
// ======================================================
// 📤 EXPORTAÇÃO
// ======================================================
exports.default = pool;
//# sourceMappingURL=connection.js.map