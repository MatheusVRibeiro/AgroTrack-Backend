"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsuarioController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const connection_1 = __importDefault(require("../database/connection"));
const id_1 = require("../utils/id");
const sql_1 = require("../utils/sql");
const validators_1 = require("../utils/validators");
const USUARIO_FIELDS = [
    'nome',
    'email',
    'senha_hash',
    'role',
    'ativo',
    'telefone',
    'cpf',
    'ultimo_acesso',
    'tentativas_login_falhas',
    'bloqueado_ate',
    'token_recuperacao',
    'token_expiracao',
];
class UsuarioController {
    async listar(_req, res) {
        try {
            const [rows] = await connection_1.default.execute('SELECT id, nome, email, role, ativo, telefone, cpf, created_at, updated_at FROM usuarios ORDER BY created_at DESC');
            res.json({
                success: true,
                message: 'Usuarios listados com sucesso',
                data: rows,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao listar usuarios',
            });
        }
    }
    async obterPorId(req, res) {
        try {
            const { id } = req.params;
            const [rows] = await connection_1.default.execute('SELECT id, nome, email, role, ativo, telefone, cpf, created_at, updated_at FROM usuarios WHERE id = ? LIMIT 1', [id]);
            const usuarios = rows;
            if (usuarios.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Usuario nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Usuario carregado com sucesso',
                data: usuarios[0],
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao obter usuario',
            });
        }
    }
    async criar(req, res) {
        try {
            const payload = validators_1.CriarUsuarioAdminSchema.parse(req.body);
            let senhaHash = payload.senha_hash;
            if (!senhaHash && payload.senha) {
                senhaHash = await bcryptjs_1.default.hash(payload.senha, 10);
            }
            // Higienização automática: Remove formatação antes de salvar
            const cpfLimpo = payload.cpf ? payload.cpf.replace(/\D/g, '') : null;
            const telefoneLimpo = payload.telefone ? payload.telefone.replace(/\D/g, '') : null;
            const id = payload.id || (0, id_1.generateId)('USR');
            const role = payload.role || 'operador';
            const ativo = payload.ativo !== undefined ? Boolean(payload.ativo) : true;
            await connection_1.default.execute(`INSERT INTO usuarios (
          id, nome, email, senha_hash, role, ativo, telefone, cpf
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                payload.nome,
                payload.email,
                senhaHash,
                role,
                ativo,
                telefoneLimpo, // Telefone sem formatação
                cpfLimpo, // CPF sem formatação
            ]);
            res.status(201).json({
                success: true,
                message: 'Usuario criado com sucesso',
                data: { id },
            });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    message: 'Dados inválidos. Verifique os campos preenchidos.',
                    error: error.errors.map((err) => err.message).join('; '),
                });
                return;
            }
            // Erro de email duplicado
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
                const message = String(error).includes('email')
                    ? 'Este e-mail já está cadastrado no sistema.'
                    : String(error).includes('cpf')
                        ? 'Este CPF já está cadastrado no sistema.'
                        : 'Dados duplicados. Verifique e-mail ou CPF.';
                res.status(409).json({
                    success: false,
                    message,
                });
                return;
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao criar usuário. Tente novamente.',
            });
        }
    }
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const payload = validators_1.AtualizarUsuarioSchema.parse(req.body);
            if (payload.senha) {
                payload.senha_hash = await bcryptjs_1.default.hash(payload.senha, 10);
            }
            const { fields, values } = (0, sql_1.buildUpdate)(payload, USUARIO_FIELDS);
            if (fields.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Nenhum campo valido para atualizar',
                });
                return;
            }
            const sql = `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);
            const [result] = await connection_1.default.execute(sql, values);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Usuario nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Usuario atualizado com sucesso',
            });
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    message: 'Dados invalidos',
                    error: error.errors.map((err) => err.message).join('; '),
                });
                return;
            }
            res.status(500).json({
                success: false,
                message: 'Erro ao atualizar usuario',
            });
        }
    }
    async deletar(req, res) {
        try {
            const { id } = req.params;
            const [result] = await connection_1.default.execute('DELETE FROM usuarios WHERE id = ?', [id]);
            const info = result;
            if (info.affectedRows === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Usuario nao encontrado',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Usuario removido com sucesso',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao remover usuario',
            });
        }
    }
}
exports.UsuarioController = UsuarioController;
//# sourceMappingURL=UsuarioController.js.map