-- =============================================================================
-- 3. TABELA: motoristas (Independente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS motoristas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Permitido NULL para evitar erro ER_DUP_ENTRY no primeiro INSERT da transação
  codigo_motorista VARCHAR(20) UNIQUE NULL COMMENT 'ID de negócio (Ex: MOT-2026-001)',
  nome VARCHAR(200) NOT NULL COMMENT 'Nome completo do motorista - OBRIGATÓRIO',
  cpf VARCHAR(14) UNIQUE COMMENT 'CPF do motorista',
  telefone VARCHAR(20) NOT NULL COMMENT 'Telefone principal - OBRIGATÓRIO',
  email VARCHAR(255),
  endereco TEXT,
  status ENUM('ativo', 'inativo', 'ferias') NOT NULL DEFAULT 'ativo',
  tipo ENUM('proprio', 'terceirizado', 'agregado') NOT NULL,
  tipo_pagamento ENUM('pix', 'transferencia_bancaria') NOT NULL DEFAULT 'pix',
  banco VARCHAR(100) NULL,
  agencia VARCHAR(10) NULL,
  conta VARCHAR(20) NULL,
  tipo_conta ENUM('corrente', 'poupanca') DEFAULT 'corrente',
  chave_pix_tipo ENUM('cpf', 'email', 'telefone', 'aleatoria', 'cnpj'),
  chave_pix VARCHAR(255),
  receita_gerada DECIMAL(15,2) DEFAULT 0.00,
  viagens_realizadas INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_tipo (tipo),
  INDEX idx_cpf (cpf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Dados de Exemplo (adaptados ao novo esquema numérico)
-- =============================================================================
INSERT INTO motoristas (
  codigo_motorista, nome, cpf, telefone, email, endereco, status, tipo,
  tipo_pagamento, chave_pix_tipo, chave_pix, receita_gerada, viagens_realizadas, created_at
) VALUES
  (
    'MOT-2026-001', 'Carlos Silva', '123.456.789-00', '(11) 98765-4321', 'carlos.silva@email.com',
    'São Paulo, SP', 'ativo', 'proprio', 'pix', 'cpf', '123.456.789-00', 89500.00, 24, CURRENT_TIMESTAMP
  ),
  (
    'MOT-2026-002', 'João Oliveira', '234.567.890-11', '(21) 97654-3210', 'joao.oliveira@email.com',
    'Rio de Janeiro, RJ', 'ativo', 'terceirizado', 'transferencia_bancaria', NULL, NULL, 78200.00, 21, CURRENT_TIMESTAMP
  ),
  (
    'MOT-2026-003', 'Pedro Santos', '345.678.901-22', '(41) 96543-2109', 'pedro.santos@email.com',
    'Curitiba, PR', 'ferias', 'proprio', 'pix', 'email', 'pedro.santos@email.com', 72100.00, 19, CURRENT_TIMESTAMP
  )
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  telefone = VALUES(telefone),
  status = VALUES(status),
  tipo = VALUES(tipo),
  tipo_pagamento = VALUES(tipo_pagamento),
  chave_pix = VALUES(chave_pix);
