import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import pool from '../database/connection';
import { generateToken } from '../middlewares/auth';
import { CriarUsuarioSchema, LoginSchema } from '../utils/validators';
import { sendValidationError } from '../utils/validation';
import { sendResetPasswordEmail, sendPasswordResetSuccessEmail } from '../services/EmailService';
import { ApiResponse } from '../types';

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
      // Usar transação para garantir atomicidade
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // 1. INSERT sem ID manual
        const insertSql = `INSERT INTO usuarios (
          nome, email, senha_hash, role, ativo
        ) VALUES (?, ?, ?, ?, ?)`;
        const insertParams = [
          data.nome,
          data.email,
          senhaHash,
          'operador', // padrão
          true
        ];
        const [result]: any = await conn.execute(insertSql, insertParams);
        const insertId = result.insertId;

        // 2. Geração da sigla/código (campo `codigo_usuario`)
        const ano = new Date().getFullYear();
        const codigo = `USR-${ano}-${String(insertId).padStart(3, '0')}`;
        await conn.execute('UPDATE usuarios SET codigo_usuario = ? WHERE id = ?', [codigo, insertId]);

        await conn.commit();

        console.log('🆔 [REGISTER] ID gerado:', codigo);
        res.status(201).json({
          success: true,
          id: codigo
        });
        return;
      } catch (txError) {
        await conn.rollback();
        console.error('[REGISTER][ERRO TRANSACTION]', txError);
        res.status(500).json({
          success: false,
          message: 'Erro ao registrar usuário (transação).'
        });
        return;
      } finally {
        conn.release();
      }

      // ...código novo já retorna o id/código na resposta acima...
    } catch (error) {
      if (sendValidationError(res, error)) {
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

      // Normalizar email para evitar divergências por espaços/maiúsculas
      const email = String(data.email).trim().toLowerCase();

      const [rows] = await pool.execute(
        'SELECT id, nome, email, senha_hash, tentativas_login_falhas, bloqueado_ate, ativo FROM usuarios WHERE email = ? LIMIT 1',
        [email]
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
      // Garantir que o usuário exista e tenha hash de senha
      if (!user || !user.senha_hash) {
        console.log('❌ [LOGIN] Usuário sem hash de senha ou inexistente:', email);
        res.status(401).json({
          success: false,
          message: 'Credenciais invalidas',
        } as ApiResponse<null>);
        return;
      }

      // Rejeitar usuários inativos
      if ('ativo' in user && user.ativo === 0) {
        console.log('🔒 [LOGIN] Tentativa de login em usuário inativo:', email);
        res.status(403).json({ success: false, message: 'Conta inativa' } as ApiResponse<null>);
        return;
      }
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
      let valid = false;
      try {
        valid = await bcrypt.compare(data.senha, user.senha_hash);
      } catch (cmpErr) {
        console.error('⚠️ [LOGIN] Erro ao comparar senhas:', cmpErr);
        valid = false;
      }
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
      if (sendValidationError(res, error)) {
        return;
      }

      console.error('💥 [LOGIN] Erro inesperado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao realizar login',
      } as ApiResponse<null>);
    }
  }

  /**
   * Solicitar recuperação de senha via email
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      console.log('📧 [FORGOT PASSWORD] Requisição recebida');
      const { email } = req.body;

      // Validação básica
      if (!email || typeof email !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Email é obrigatório',
        } as ApiResponse<null>);
        return;
      }

      // Procurar usuário
      const [rows] = await pool.execute('SELECT id, nome, email FROM usuarios WHERE email = ? LIMIT 1', [email]);
      const usuarios = rows as Array<{ id: number; nome: string; email: string }>;

      if (usuarios.length === 0) {
        // Por segurança, não revelar se o email existe ou não
        console.log('⚠️ [FORGOT PASSWORD] Email não encontrado:', email);
        res.json({
          success: true,
          message: 'Se o email estiver registrado, você receberá um link de recuperação em breve.',
        } as ApiResponse<null>);
        return;
      }

      const usuario = usuarios[0];
      console.log('✅ [FORGOT PASSWORD] Usuário encontrado:', usuario.email);

      // Gerar token de recuperação (40 caracteres randômicos em hexadecimal)
      const tokenRecuperacao = randomBytes(20).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      console.log('🔑 [FORGOT PASSWORD] Token gerado. Expira em:', tokenExpiresAt);

      // Armazenar token no banco
      await pool.execute(
        `UPDATE usuarios 
         SET token_recuperacao = ?, token_expiracao = ?
         WHERE id = ?`,
        [tokenRecuperacao, tokenExpiresAt, usuario.id]
      );

      console.log('💾 [FORGOT PASSWORD] Token armazenado no banco');

      // Enviar email
      try {
        await sendResetPasswordEmail(usuario.email, tokenRecuperacao, usuario.nome);
        console.log('📧 [FORGOT PASSWORD] Email enviado com sucesso');
      } catch (emailError) {
        console.error('💥 [FORGOT PASSWORD] Erro ao enviar email:', emailError);
        // Mesmo com erro de email, responder que enviamos (não revelar détalhes)
      }

      res.json({
        success: true,
        message: 'Se o email estiver registrado, você receberá um link de recuperação em breve.',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('💥 [FORGOT PASSWORD] Erro inesperado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar recuperação de senha',
      } as ApiResponse<null>);
    }
  }

  /**
   * Redefinir senha com token de recuperação
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔐 [RESET PASSWORD] Requisição recebida');
      const { token, novaSenha, confirmaSenha } = req.body;

      // Validação básica
      if (!token || !novaSenha || !confirmaSenha) {
        res.status(400).json({
          success: false,
          message: 'Token, nova senha e confirmação são obrigatórios',
        } as ApiResponse<null>);
        return;
      }

      // Validar senhas
      if (novaSenha !== confirmaSenha) {
        res.status(400).json({
          success: false,
          message: 'As senhas não conferem',
        } as ApiResponse<null>);
        return;
      }

      // Validar força da senha - mínimo 6 caracteres
      if (novaSenha.length < 6) {
        res.status(400).json({
          success: false,
          message: 'A senha deve ter pelo menos 6 caracteres',
        } as ApiResponse<null>);
        return;
      }

      // Procurar usuário com token válido
      const [rows] = await pool.execute(
        `SELECT id, nome, email FROM usuarios 
         WHERE token_recuperacao = ? 
         AND token_expiracao > NOW()
         LIMIT 1`,
        [token]
      );

      const usuarios = rows as Array<{ id: number; nome: string; email: string }>;

      if (usuarios.length === 0) {
        console.log('❌ [RESET PASSWORD] Token inválido ou expirado');
        res.status(400).json({
          success: false,
          message: 'Token inválido ou expirado. Solicite uma nova recuperação.',
        } as ApiResponse<null>);
        return;
      }

      const usuario = usuarios[0];
      console.log('✅ [RESET PASSWORD] Token válido para usuário:', usuario.email);

      // Hash da nova senha
      console.log('🔐 [RESET PASSWORD] Gerando hash da nova senha...');
      const senhaHash = await bcrypt.hash(novaSenha, 10);

      // Atualizar senha e limpar token
      await pool.execute(
        `UPDATE usuarios 
         SET senha_hash = ?, token_recuperacao = NULL, token_expiracao = NULL
         WHERE id = ?`,
        [senhaHash, usuario.id]
      );

      console.log('✅ [RESET PASSWORD] Senha atualizada com sucesso');

      // Enviar email de confirmação
      try {
        await sendPasswordResetSuccessEmail(usuario.email, usuario.nome);
        console.log('📧 [RESET PASSWORD] Email de confirmação enviado');
      } catch (emailError) {
        console.error('⚠️ [RESET PASSWORD] Erro ao enviar email de confirmação:', emailError);
        // Continuar mesmo se falhar, pois a senha já foi alterada
      }

      res.json({
        success: true,
        message: 'Senha redefinida com sucesso. Você pode fazer login agora.',
      } as ApiResponse<null>);
    } catch (error) {
      if (sendValidationError(res, error)) {
        return;
      }

      console.error('💥 [RESET PASSWORD] Erro inesperado:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao redefinir senha',
      } as ApiResponse<null>);
    }
  }
}

