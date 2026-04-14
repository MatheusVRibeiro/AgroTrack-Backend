import pool from '../database/connection';

/**
 * Tempo máximo (em dias) sem acesso antes de desativar o usuário automaticamente.
 * Configurável via variável de ambiente INACTIVITY_DISABLE_DAYS.
 */
const INACTIVITY_DISABLE_DAYS = parseInt(process.env.INACTIVITY_DISABLE_DAYS || '90', 10);

/**
 * Intervalo de execução do job (em ms). Padrão: 1 hora.
 */
const CHECK_INTERVAL_MS = parseInt(process.env.INACTIVITY_CHECK_INTERVAL_MS || String(60 * 60 * 1000), 10);

/**
 * Job que verifica e desativa automaticamente usuários inativos.
 *
 * Regra:
 *   Se `ultimo_acesso` > INACTIVITY_DISABLE_DAYS dias atrás
 *   E o usuário está ativo (ativo = 1)
 *   → Marcar como inativo (ativo = 0)
 *
 * Não afeta administradores (role = 'admin'), que devem ser desativados manualmente.
 */
async function desativarUsuariosInativos(): Promise<number> {
  try {
    const [result] = await pool.execute(
      `UPDATE usuarios 
       SET ativo = 0
       WHERE ativo = 1
         AND role != 'admin'
         AND ultimo_acesso IS NOT NULL
         AND ultimo_acesso < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [INACTIVITY_DISABLE_DAYS]
    );

    const info = result as { affectedRows: number };
    
    if (info.affectedRows > 0) {
      console.log(
        `🔒 Inativação automática: ${info.affectedRows} usuário(s) desativado(s) por mais de ${INACTIVITY_DISABLE_DAYS} dias sem acesso.`
      );
    }

    return info.affectedRows;
  } catch (error) {
    console.error('❌ Erro no job de inativação automática:', error);
    return 0;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia o job de inativação automática.
 * Executa uma vez imediatamente e depois a cada intervalo configurado.
 */
export function startInactivityJob(): void {
  console.log(
    `⏱️  Job de inativação automática iniciado (limite: ${INACTIVITY_DISABLE_DAYS} dias, intervalo: ${CHECK_INTERVAL_MS / 1000}s)`
  );

  // Executar imediatamente na inicialização (com delay de 5s para o DB conectar)
  setTimeout(() => {
    desativarUsuariosInativos();
  }, 5000);

  // Agendar execução periódica
  intervalId = setInterval(() => {
    desativarUsuariosInativos();
  }, CHECK_INTERVAL_MS);
}

/**
 * Para o job (útil para graceful shutdown).
 */
export function stopInactivityJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
