import nodemailer from 'nodemailer';

// Configurar transporte SMTP da Hostinger ou Ethereal
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: Number(process.env.MAIL_PORT) === 465, // true para 465 (SSL), false para 587 (TLS)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  logger: true, // Ativar logs para debug
  debug: true, // Ativar debug
});

/**
 * Enviar email de recuperação de senha
 * @param to - Email do usuário
 * @param token - Token de recuperação gerado
 * @param usuarioNome - Nome do usuário para personalização
 */
export const sendResetPasswordEmail = async (
  to: string,
  token: string,
  usuarioNome: string = 'Usuário'
): Promise<boolean> => {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.MAIL_FROM || 'Caramello Logística <sistemas@caramellologistica.com>',
      to,
      subject: 'Recuperação de Senha - Caramello Logística',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <!-- Logo/Header -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1f2937; margin: 0; font-size: 24px;">Caramello Logística</h1>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Sistema de Gestão de Fretes</p>
            </div>

            <!-- Conteúdo Principal -->
            <div style="border-top: 2px solid #f59e0b; padding-top: 20px;">
              <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0;">Olá, ${usuarioNome}!</h2>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                Recebemos uma solicitação para redefinir a senha da sua conta na <strong>Caramello Logística</strong>.
              </p>

              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0;">
                Para definir uma nova senha, clique no botão abaixo:
              </p>

              <!-- Botão de Ação -->
              <div style="text-align: center; margin: 30px 0;">
                <a 
                  href="${resetLink}" 
                  style="display: inline-block; padding: 12px 30px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; transition: background-color 0.3s ease;"
                  onmouseover="this.style.backgroundColor='#d97706'"
                  onmouseout="this.style.backgroundColor='#f59e0b'"
                >
                  Recuperar Senha
                </a>
              </div>

              <!-- Aviso de Segurança -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #92400e; margin: 0; font-size: 13px;">
                  <strong>⏱️ Este link expira em 15 minutos.</strong> Se não foi você que solicitou, ignore este email.
                </p>
              </div>

              <!-- Link alternativo -->
              <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                Se o botão acima não funcionar, copie e cole o link abaixo no navegador:
              </p>
              <p style="color: #f59e0b; font-size: 11px; word-break: break-all; margin: 10px 0;">
                ${resetLink}
              </p>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; text-align: center; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 5px 0;">
                Caramello Logística © 2026<br/>
                Todos os direitos reservados
              </p>
              <p style="margin: 5px 0 0 0; font-size: 11px;">
                <a href="https://caramellologistica.com" style="color: #f59e0b; text-decoration: none;">Visite nosso site</a>
              </p>
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ [EMAIL] Recuperação de senha enviada para:', to);
    console.log('📧 Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('💥 [EMAIL] Erro ao enviar email de recuperação:', error);
    throw error;
  }
};

/**
 * Enviar email de confirmação de nova senha
 * @param to - Email do usuário
 * @param usuarioNome - Nome do usuário
 */
export const sendPasswordResetSuccessEmail = async (
  to: string,
  usuarioNome: string = 'Usuário'
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || 'Caramello Logística <sistemas@caramellologistica.com>',
      to,
      subject: 'Senha Redefinida com Sucesso - Caramello Logística',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1f2937; margin: 0; font-size: 24px;">Caramello Logística</h1>
            </div>

            <div style="border-top: 2px solid #10b981; padding-top: 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
              <h2 style="color: #10b981; font-size: 18px; margin: 0 0 15px 0;">Senha Redefinida com Sucesso</h2>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                Olá, ${usuarioNome}!<br/>
                Sua senha foi redefinida com sucesso. Você já pode fazer login com a nova senha.
              </p>

              <a 
                href="${process.env.FRONTEND_URL}/login" 
                style="display: inline-block; padding: 12px 30px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;"
              >
                Acessar Sistema
              </a>
            </div>

            <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; text-align: center; font-size: 12px; color: #6b7280;">
              <p style="margin: 0;">Caramello Logística © 2026</p>
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ [EMAIL] Confirmação de senha redefinida enviada para:', to);
    return true;
  } catch (error) {
    console.error('💥 [EMAIL] Erro ao enviar confirmação:', error);
    throw error;
  }
};

/**
 * Testar conexão SMTP
 */
export const testEmailConnection = async (): Promise<void> => {
  try {
    await transporter.verify();
    console.log('✅ [EMAIL] Conexão SMTP verificada com sucesso!');
  } catch (error) {
    console.error('💥 [EMAIL] Erro na conexão SMTP:', error);
    throw error;
  }
};
