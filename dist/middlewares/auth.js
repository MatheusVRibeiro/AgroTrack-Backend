"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'seu_secret_key_aqui';
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({
                success: false,
                message: 'Token não fornecido',
            });
            return;
        }
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.userId = decoded.id;
            req.user = {
                id: decoded.id,
                email: decoded.email,
            };
            next();
        }
        catch (error) {
            res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado',
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao validar token',
        });
    }
};
exports.authMiddleware = authMiddleware;
const generateToken = (id, email) => {
    return jsonwebtoken_1.default.sign({ id, email }, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};
exports.generateToken = generateToken;
//# sourceMappingURL=auth.js.map