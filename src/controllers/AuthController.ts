import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import pool from '../database/connection';
import { generateToken } from '../middlewares/auth';
import { CriarUsuarioSchema, LoginSchema } from '../utils/validators';
import { ApiResponse } from '../types';
import { generateId } from '../utils/id';

export class AuthController {
  async registrar(req: Request, res: Response): Promise<void> {
    try {
      console.log('📝 [REGISTER] Requisição recebida');
      console.log('📦 [REGISTER] Body:', JSON.stringify(req.body));
      
      const data = CriarUsuarioSchema.parse(req.body);
      console.log('✅ [REGISTER] Validação Zod passou - Email:', data.email);

      const [existingRows] = await pool.execute(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        [data.email]
      );

      const existing = existingRows as { id: string }[];
      console.log('🔍 [REGISTER] Email já existe:', existing.length > 0);
      
      if (existing.length > 0) {
        console.log('⚠️ [REGISTER] Email já cadastrado:', data.email);
        res.status(409).json({
          success: false,
          message: 'Email ja cadastrado',
        } as ApiResponse<null>);
        return;
      }

      console.log('🔐 [REGISTER] Gerando hash da senha...');
      const senhaHash = await bcrypt.hash(data.senha, 10);
      const id = generateId('USR');
      console.log('🆔 [REGISTER] ID gerado:', id);

      await pool.execute(
        'INSERT INTO usuarios (id, nome, email, senha_hash) VALUES (?, ?, ?, ?)',
        [id, data.nome, data.email, senhaHash]
      );
      console.log('✅ [REGISTER] Usuário criado com sucesso:', data.email);

      res.status(201).json({
        success: true,
        message: 'Usuario criado com sucesso',
        data: { id, nome: data.nome, email: data.email },
      } as ApiResponse<{ id: string; nome: string; email: string }>);
    } catch (error) {
      if (error instanceof ZodError) {
        console.log('⚠️ [REGISTER] Erro de validação Zod:', error.errors);
        res.status(400).json({
          success: false,
          message: 'Dados invalidos',
          error: error.errors.map((err) => err.message).join('; '),
        } as ApiResponse<null>);
        return;
      }

      console.error('💥 [REGISTER] Erro inesperado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao registrar usuario',
      } as ApiResponse<null>);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔐 [LOGIN] Requisição recebida');
      console.log('📦 [LOGIN] Body:', JSON.stringify(req.body));
      
      const data = LoginSchema.parse(req.body);
      console.log('✅ [LOGIN] Validação Zod passou - Email:', data.email);

      const [rows] = await pool.execute(
        'SELECT id, nome, email, senha_hash, tentativas_login_falhas, bloqueado_ate FROM usuarios WHERE email = ? LIMIT 1',
        [data.email]
      );

      const users = rows as Array<{ 
        id: string;
        nome: string;
        email: string;
        senha_hash: string;
        tentativas_login_falhas: number;
        bloqueado_ate: Date | null;
      }>;
      console.log('🔍 [LOGIN] Usuários encontrados:', users.length);
      
      if (users.length === 0) {
        console.log('❌ [LOGIN] Usuário não encontrado:', data.email);
        res.status(401).json({
          success: false,
          message: 'Credenciais invalidas',
        } as ApiResponse<null>);
        return;
      }

      const user = users[0];
      console.log('👤 [LOGIN] Usuário encontrado:', { id: user.id, email: user.email, nome: user.nome });
      console.log('🔒 [LOGIN] Tentativas falhas:', user.tentativas_login_falhas);
      console.log('🔒 [LOGIN] Bloqueado até:', user.bloqueado_ate);
      
      // Verificar se está bloqueado
      if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
        const minutosRestantes = Math.ceil((new Date(user.bloqueado_ate).getTime() - Date.now()) / 60000);
        console.log('⛔ [LOGIN] Usuário bloqueado. Minutos restantes:', minutosRestantes);
        res.status(403).json({
          success: false,
          message: `Conta bloqueada. Tente novamente em ${minutosRestantes} minuto(s).`,
        } as ApiResponse<null>);
        return;
      }
      
      console.log('🔑 [LOGIN] Comparando senha...');
      const valid = await bcrypt.compare(data.senha, user.senha_hash);
      console.log('🔑 [LOGIN] Senha válida:', valid);
      
      if (!valid) {
        console.log('❌ [LOGIN] Senha incorreta para:', data.email);
        
        // Incrementar tentativas
        const novasTentativas = user.tentativas_login_falhas + 1;
        console.log('⚠️ [LOGIN] Incrementando tentativas para:', novasTentativas);
        
        // Bloquear se atingir 8 tentativas
        if (novasTentativas >= 8) {
          await pool.execute(
            'UPDATE usuarios SET tentativas_login_falhas = ?, bloqueado_ate = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
            [novasTentativas, user.id]
          );
          console.log('🚫 [LOGIN] Conta bloqueada por 15 minutos após 8 tentativas');
          res.status(403).json({
            success: false,
            message: 'Conta bloqueada por 15 minutos devido a múltiplas tentativas falhas.',
          } as ApiResponse<null>);
          return;
        } else {
          await pool.execute(
            'UPDATE usuarios SET tentativas_login_falhas = ? WHERE id = ?',
            [novasTentativas, user.id]
          );
          const tentativasRestantes = 8 - novasTentativas;
          console.log('⚠️ [LOGIN] Tentativas restantes:', tentativasRestantes);
          res.status(401).json({
            success: false,
            message: `Credenciais inválidas. ${tentativasRestantes} tentativa(s) restante(s).`,
          } as ApiResponse<null>);
          return;
        }
      }

      const token = generateToken(user.id, user.email);
      console.log('🎫 [LOGIN] Token gerado com sucesso (15 dias)');
      
      // Resetar tentativas de login e remover bloqueio
      await pool.execute(
        'UPDATE usuarios SET tentativas_login_falhas = 0, bloqueado_ate = NULL, ultimo_acesso = NOW() WHERE id = ?',
        [user.id]
      );
      console.log('✅ [LOGIN] Login realizado com sucesso para:', user.email);
      console.log('🔓 [LOGIN] Tentativas resetadas e bloqueio removido');

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        token,
        usuario: {
          id: user.id,
          nome: user.nome,
          email: user.email,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        console.log('⚠️ [LOGIN] Erro de validação Zod:', error.errors);
        res.status(400).json({
          success: false,
          message: 'Dados invalidos',
          error: error.errors.map((err) => err.message).join('; '),
        } as ApiResponse<null>);
        return;
      }

      console.error('💥 [LOGIN] Erro inesperado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao realizar login',
      } as ApiResponse<null>);
    }
  }
}
