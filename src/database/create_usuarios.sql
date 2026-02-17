-- =============================================================================
-- 2. TABELA: usuarios (Independente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Permitido NULL para suportar a geração do código via Transaction no Backend
  codigo_usuario VARCHAR(20) UNIQUE NULL COMMENT 'ID de negócio (Ex: USR-2026-001)',
  nome VARCHAR(200) NOT NULL COMMENT 'Nome completo do usuário',
  email VARCHAR(255) NOT NULL UNIQUE COMMENT 'Email para login (único)',
  senha_hash VARCHAR(255) NOT NULL COMMENT 'Hash da senha (bcrypt)',
  role ENUM('admin', 'contabilidade', 'operador') NOT NULL DEFAULT 'operador' COMMENT 'Nível de acesso',
  ativo BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Status do usuário',
  telefone VARCHAR(20),
  cpf VARCHAR(14) UNIQUE,
  ultimo_acesso TIMESTAMP NULL,
  tentativas_login_falhas INT DEFAULT 0,
  bloqueado_ate TIMESTAMP NULL,
  token_recuperacao VARCHAR(255),
  token_expiracao TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Expansão Futura - Usuário Contabilidade (Exemplo)
-- =============================================================================
-- INSERT INTO usuarios (
--   id, nome, email, senha_hash, role, ativo
-- ) VALUES (
--   'USR-002',
--   'Contador Sistema',
--   'contabilidade@rnlogistica.com',
--   '$2a$10$hash_aqui',
--   'contabilidade',
--   TRUE
-- );

-- =============================================================================
-- Usuário Inicial (Gestor Principal) - exemplo adaptado ao novo esquema
-- Nota: alterar a senha após o primeiro login
-- Senha exemplo: "Admin@2025" (substituir pelo hash real em produção)
INSERT INTO usuarios (
  codigo_usuario, nome, email, senha_hash, role, ativo, created_at
) VALUES (
  'USR-2026-001',
  'Administrador Sistema',
  'admin@rnlogistica.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye1J5fQZHEKhQ7M5f9mNvTLtCkMLr6j.K',
  'admin',
  TRUE,
  CURRENT_TIMESTAMP
) ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  role = VALUES(role),
  ativo = VALUES(ativo);

-- =============================================================================
-- Manutenção e Segurança
-- =============================================================================

-- Desativar usuário (soft delete)
-- UPDATE usuarios SET ativo = FALSE WHERE id = 'USR-XXX';

-- Reativar usuário
-- UPDATE usuarios SET ativo = TRUE WHERE id = 'USR-XXX';

-- Resetar tentativas de login
-- UPDATE usuarios SET tentativas_login_falhas = 0, bloqueado_ate = NULL WHERE id = 'USR-XXX';

-- Forçar alteração de senha no próximo login (implementação futura)
-- ALTER TABLE usuarios ADD COLUMN deve_alterar_senha BOOLEAN DEFAULT FALSE;
-- UPDATE usuarios SET deve_alterar_senha = TRUE WHERE id = 'USR-XXX';
