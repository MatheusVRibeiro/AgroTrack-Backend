-- =============================================================================
-- SCRIPT MASTER DE INICIALIZAÇÃO DO BANCO DE DADOS
-- RN Logística - Sistema de Gestão de Fretes
-- =============================================================================

-- =============================================================================
-- 1. TABELA: usuarios (Independente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(255) PRIMARY KEY COMMENT 'ID único do usuário',
  nome VARCHAR(200) NOT NULL COMMENT 'Nome completo do usuário',
  email VARCHAR(255) NOT NULL UNIQUE COMMENT 'Email para login (único)',
  senha_hash VARCHAR(255) NOT NULL COMMENT 'Hash da senha (bcrypt)',
  role ENUM('admin', 'contabilidade', 'operador') NOT NULL DEFAULT 'operador' COMMENT 'Nível de acesso do usuário',
  ativo BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Indica se o usuário está ativo no sistema',
  telefone VARCHAR(20) COMMENT 'Telefone de contato',
  cpf VARCHAR(14) UNIQUE COMMENT 'CPF do usuário (opcional)',
  ultimo_acesso TIMESTAMP NULL COMMENT 'Data/hora do último login',
  tentativas_login_falhas INT DEFAULT 0 COMMENT 'Contador de tentativas de login falhas',
  bloqueado_ate TIMESTAMP NULL COMMENT 'Data/hora até quando o usuário está bloqueado',
  token_recuperacao VARCHAR(255) COMMENT 'Token para recuperação de senha',
  token_expiracao TIMESTAMP NULL COMMENT 'Data/hora de expiração do token',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. TABELA: motoristas (Independente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS motoristas (
  id VARCHAR(255) PRIMARY KEY COMMENT 'ID único do motorista',
  nome VARCHAR(200) NOT NULL COMMENT 'Nome completo do motorista',
  cpf VARCHAR(14) NOT NULL UNIQUE COMMENT 'CPF do motorista',
  telefone VARCHAR(20) NOT NULL COMMENT 'Telefone principal',
  email VARCHAR(255) NOT NULL COMMENT 'Email de contato',
  endereco TEXT COMMENT 'Endereço completo',
  cnh VARCHAR(20) NOT NULL UNIQUE COMMENT 'Número da CNH',
  cnh_validade DATE NOT NULL COMMENT 'Data de validade da CNH',
  cnh_categoria VARCHAR(5) NOT NULL COMMENT 'Categoria da CNH (A, B, C, D, E)',
  status ENUM('ativo', 'inativo', 'ferias') NOT NULL DEFAULT 'ativo',
  tipo ENUM('proprio', 'terceirizado') NOT NULL,
  data_admissao DATE NOT NULL,
  data_desligamento DATE,
  tipo_pagamento ENUM('pix', 'transferencia_bancaria') DEFAULT 'pix',
  chave_pix_tipo ENUM('cpf', 'email', 'telefone', 'aleatoria') NULL,
  chave_pix VARCHAR(255) NULL,
  banco VARCHAR(100) NULL,
  agencia VARCHAR(10) NULL,
  conta VARCHAR(20) NULL,
  tipo_conta ENUM('corrente', 'poupanca') NULL DEFAULT NULL,
  receita_gerada DECIMAL(15,2) DEFAULT 0.00,
  viagens_realizadas INT DEFAULT 0,
  caminhao_atual VARCHAR(255) COMMENT 'Placa do caminhão atual (referência)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cpf (cpf),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. TABELA: fazendas (Independente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS fazendas (
  id VARCHAR(255) PRIMARY KEY COMMENT 'ID único da fazenda',
  fazenda VARCHAR(200) NOT NULL COMMENT 'Nome da fazenda',
  localizacao VARCHAR(255) NOT NULL COMMENT 'Cidade/Estado da fazenda',
  proprietario VARCHAR(200) NOT NULL,
  mercadoria VARCHAR(100) NOT NULL,
  variedade VARCHAR(100),
  safra VARCHAR(20) NOT NULL,
  preco_por_tonelada DECIMAL(10,2) NOT NULL,
  peso_medio_saca DECIMAL(10,2) DEFAULT 25.00,
  total_sacas_carregadas INT DEFAULT 0,
  total_toneladas DECIMAL(15,2) DEFAULT 0.00,
  faturamento_total DECIMAL(15,2) DEFAULT 0.00,
  ultimo_frete DATE,
  colheita_finalizada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fazenda (fazenda),
  INDEX idx_safra (safra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. TABELA: Frota (Depende de motoristas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS frota (
  id VARCHAR(255) PRIMARY KEY,
  placa VARCHAR(10) NOT NULL UNIQUE,
  placa_carreta VARCHAR(10) UNIQUE,
  modelo VARCHAR(100) NOT NULL,
  ano_fabricacao INT NOT NULL,
  status ENUM('disponivel', 'em_viagem', 'manutencao') NOT NULL DEFAULT 'disponivel',
  motorista_fixo_id VARCHAR(255),
  capacidade_toneladas DECIMAL(10,2) NOT NULL,
  km_atual INT NOT NULL DEFAULT 0,
  tipo_combustivel ENUM('DIESEL', 'S10', 'ARLA', 'OUTRO') DEFAULT 'S10',
  tipo_veiculo ENUM('TRUCADO', 'TOCO', 'CARRETA', 'BITREM', 'RODOTREM') NOT NULL,
  renavam VARCHAR(20) UNIQUE,
  renavam_carreta VARCHAR(20) UNIQUE,
  chassi VARCHAR(30) UNIQUE,
  registro_antt VARCHAR(20),
  validade_seguro DATE,
  validade_licenciamento DATE,
  proprietario_tipo ENUM('PROPRIO', 'TERCEIRO', 'AGREGADO') DEFAULT 'PROPRIO',
  ultima_manutencao_data DATE,
  proxima_manutencao_km INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (motorista_fixo_id) REFERENCES motoristas(id) ON DELETE SET NULL,
  INDEX idx_placa (placa),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. TABELA: pagamentos (Depende de motoristas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pagamentos (
  id VARCHAR(255) PRIMARY KEY COMMENT 'ID único (Ex: PAG-2026-001)',
  motorista_id VARCHAR(255) NOT NULL,
  motorista_nome VARCHAR(200) NOT NULL,
  periodo_fretes VARCHAR(50) NOT NULL,
  quantidade_fretes INT NOT NULL DEFAULT 1,
  fretes_incluidos TEXT COMMENT 'IDs dos fretes vinculados',
  total_toneladas DECIMAL(10,2) NOT NULL,
  valor_por_tonelada DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  status ENUM('pendente', 'processando', 'pago', 'cancelado') DEFAULT 'pendente',
  metodo_pagamento ENUM('pix', 'transferencia_bancaria') NOT NULL,
  comprovante_nome VARCHAR(255),
  comprovante_url TEXT,
  comprovante_data_upload TIMESTAMP NULL,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (motorista_id) REFERENCES motoristas(id) ON DELETE RESTRICT,
  INDEX idx_motorista (motorista_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. TABELA: fretes (Depende de motoristas, Frota, fazendas e pagamentos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS fretes (
  id VARCHAR(255) PRIMARY KEY COMMENT 'ID único (Ex: FRETE-2026-001)',
  origem VARCHAR(255) NOT NULL,
  destino VARCHAR(255) NOT NULL,
  motorista_id VARCHAR(255) NOT NULL,
  motorista_nome VARCHAR(200) NOT NULL,
  caminhao_id VARCHAR(255) NOT NULL,
  caminhao_placa VARCHAR(10) NOT NULL,
  fazenda_id VARCHAR(255),
  fazenda_nome VARCHAR(200),
  mercadoria VARCHAR(100) NOT NULL,
  mercadoria_id VARCHAR(255),
  variedade VARCHAR(100),
  data_frete DATE NOT NULL,
  quantidade_sacas INT NOT NULL,
  toneladas DECIMAL(10,2) NOT NULL,
  valor_por_tonelada DECIMAL(10,2) NOT NULL,
  receita DECIMAL(10,2) NOT NULL,
  custos DECIMAL(10,2) DEFAULT 0.00,
  resultado DECIMAL(10,2),
  pagamento_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (motorista_id) REFERENCES motoristas(id) ON DELETE RESTRICT,
  FOREIGN KEY (caminhao_id) REFERENCES frota(id) ON DELETE RESTRICT,
  FOREIGN KEY (fazenda_id) REFERENCES fazendas(id) ON DELETE RESTRICT,
  FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE SET NULL,
  INDEX idx_data_frete (data_frete),
  INDEX idx_fazenda (fazenda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 7. TABELA: custos (Depende de fretes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS custos (
  id VARCHAR(255) PRIMARY KEY,
  frete_id VARCHAR(255) NOT NULL,
  tipo ENUM('combustivel', 'manutencao', 'pedagio', 'outros') NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  comprovante BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  motorista VARCHAR(200),
  caminhao VARCHAR(10),
  rota VARCHAR(255),
  litros DECIMAL(10,2),
  tipo_combustivel ENUM('gasolina', 'diesel', 'etanol', 'gnv'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (frete_id) REFERENCES fretes(id) ON DELETE CASCADE,
  INDEX idx_frete_id (frete_id),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- DADOS DE EXEMPLO
-- =============================================================================

-- 1. USUÁRIOS
INSERT INTO usuarios (id, nome, email, senha_hash, role) VALUES
('u1', 'Administrador RN', 'admin@rnlogistica.com', 'hash_senha_1', 'admin'),
('u2', 'Renata Operacional', 'renata@rnlogistica.com', 'hash_senha_2', 'operador'),
('u3', 'Pedro Contábil', 'pedro@rnlogistica.com', 'hash_senha_3', 'contabilidade'),
('u4', 'Suporte Sistema', 'suporte@tech.com', 'hash_senha_4', 'operador');

-- 2. MOTORISTAS
INSERT INTO motoristas (id, nome, cpf, telefone, email, cnh, cnh_validade, cnh_categoria, tipo, data_admissao) VALUES
('m1', 'Carlos Silva', '123.456.789-01', '(14) 99123-4567', 'carlos@gmail.com', '123456789', '2028-12-31', 'E', 'proprio', '2024-01-10'),
('m2', 'Pedro Oliveira', '234.567.890-12', '(14) 99234-5678', 'pedro.driver@gmail.com', '987654321', '2027-05-15', 'E', 'proprio', '2024-02-15'),
('m3', 'João Santos', '345.678.901-23', '(18) 99345-6789', 'joao.transp@outlook.com', '456123789', '2026-08-20', 'D', 'terceirizado', '2024-03-01'),
('m4', 'Marcos Souza', '456.789.012-34', '(14) 99456-7890', 'marcos.amendoim@hotmail.com', '321654987', '2029-10-10', 'E', 'proprio', '2024-01-20');

-- 3. FAZENDAS
INSERT INTO fazendas (id, fazenda, localizacao, proprietario, mercadoria, safra, preco_por_tonelada) VALUES
('fz1', 'Fazenda Santo Antônio', 'Pompeia/SP', 'Antônio Ferreira', 'Amendoim', '2025/2026', 650.00),
('fz2', 'Fazenda Boa Vista', 'Marília/SP', 'José Roberto', 'Amendoim', '2025/2026', 620.00),
('fz3', 'Sítio Santa Rita', 'Quintana/SP', 'Maria Clara', 'Amendoim', '2025/2026', 640.00),
('fz4', 'Fazenda Palmeiras', 'Herculândia/SP', 'Ricardo Bueno', 'Amendoim', '2025/2026', 635.00);

-- 4. FROTA
INSERT INTO frota (id, placa, modelo, ano_fabricacao, motorista_fixo_id, capacidade_toneladas, tipo_veiculo) VALUES
('v1', 'ABC-1234', 'Volvo FH 540', 2022, 'm1', 35.00, 'BITREM'),
('v2', 'DEF-5678', 'Scania R450', 2021, 'm2', 32.00, 'CARRETA'),
('v3', 'GHI-9012', 'Mercedes Actros', 2023, 'm4', 35.00, 'BITREM'),
('v4', 'JKL-3456', 'VW Meteor', 2022, NULL, 30.00, 'CARRETA');

-- 5. PAGAMENTOS
INSERT INTO pagamentos (id, motorista_id, motorista_nome, periodo_fretes, total_toneladas, valor_por_tonelada, valor_total, data_pagamento, status, metodo_pagamento) VALUES
('p1', 'm1', 'Carlos Silva', '01-05/02/2026', 32.50, 650.00, 21125.00, '2026-02-10', 'pendente', 'pix'),
('p2', 'm2', 'Pedro Oliveira', '02/02/2026', 28.00, 620.00, 17360.00, '2026-02-10', 'pago', 'transferencia_bancaria'),
('p3', 'm4', 'Marcos Souza', '03/02/2026', 34.20, 640.00, 21888.00, '2026-02-12', 'pendente', 'pix'),
('p4', 'm3', 'João Santos', '04/02/2026', 30.00, 635.00, 19050.00, '2026-02-15', 'processando', 'pix');

-- 6. FRETES
INSERT INTO fretes (id, origem, destino, motorista_id, motorista_nome, caminhao_id, caminhao_placa, fazenda_id, fazenda_nome, mercadoria, data_frete, quantidade_sacas, toneladas, valor_por_tonelada, receita, pagamento_id) VALUES
('f1', 'Fazenda Santo Antônio', 'Usina Pompeia', 'm1', 'Carlos Silva', 'v1', 'ABC-1234', 'fz1', 'Fazenda Santo Antônio', 'Amendoim Casca', '2026-02-01', 1300, 32.50, 650.00, 21125.00, 'p1'),
('f2', 'Fazenda Boa Vista', 'Secador Marília', 'm2', 'Pedro Oliveira', 'v2', 'DEF-5678', 'fz2', 'Fazenda Boa Vista', 'Amendoim Verde', '2026-02-02', 1120, 28.00, 620.00, 17360.00, 'p2'),
('f3', 'Sítio Santa Rita', 'Usina Tupã', 'm4', 'Marcos Souza', 'v3', 'GHI-9012', 'fz3', 'Sítio Santa Rita', 'Amendoim Casca', '2026-02-03', 1368, 34.20, 640.00, 21888.00, 'p3'),
('f4', 'Fazenda Palmeiras', 'Usina Pompeia', 'm3', 'João Santos', 'v4', 'JKL-3456', 'fz4', 'Fazenda Palmeiras', 'Amendoim Runner', '2026-02-04', 1200, 30.00, 635.00, 19050.00, 'p4');

-- 7. CUSTOS
INSERT INTO custos (id, frete_id, tipo, descricao, valor, data, motorista, caminhao, rota) VALUES
('c1', 'f1', 'combustivel', 'Abastecimento Posto São Paulo', 1200.00, '2026-02-01', 'Carlos Silva', 'ABC-1234', 'Pompeia -> Marília'),
('c2', 'f1', 'pedagio', 'Pedágio Rod. Comandante João Ribeiro', 154.50, '2026-02-01', 'Carlos Silva', 'ABC-1234', 'Pompeia -> Marília'),
('c3', 'f2', 'combustivel', 'Diesel S10 Intermunicipal', 950.00, '2026-02-02', 'Pedro Oliveira', 'DEF-5678', 'Marília -> Pompeia'),
('c4', 'f3', 'manutencao', 'Troca de pneu estourado', 2200.00, '2026-02-03', 'Marcos Souza', 'GHI-9012', 'Quintana -> Tupã');
