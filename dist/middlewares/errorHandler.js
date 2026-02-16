"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const errorHandler = (err, _req, res, _next) => {
    console.error('Error:', err);
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            message: 'Erro de validação',
            errors: err.errors,
        });
        return;
    }
    const statusCode = err instanceof Error && 'statusCode' in err ? err.statusCode || 500 : 500;
    const message = err.message || 'Erro interno do servidor';
    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map