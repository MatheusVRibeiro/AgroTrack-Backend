-- =============================================================================
-- Tabela: motoristas
-- Descrição: Cadastro completo de motoristas (próprios e terceirizados)
-- =============================================================================

CREATE TABLE IF NOT EXISTS motoristas (
  -- Identificação Principal
  id VARCHAR(255) PRIMARY KEY COMMENT 'ID único do motorista',
  nome VARCHAR(200) NOT NULL COMMENT 'Nome completo do motorista - OBRIGATÓRIO',
  
  -- Contato
  telefone VARCHAR(20) NOT NULL COMMENT 'Telefone principal - OBRIGATÓRIO',
  email VARCHAR(255) COMMENT 'Email de contato (Opcional)',
  endereco TEXT COMMENT 'Endereço completo (Opcional)',
  
  -- Documentação (Flexibilizada: NULL permitido para cadastro rápido)
  cpf VARCHAR(14) UNIQUE COMMENT 'CPF (Opcional no início)',
  cnh VARCHAR(20) UNIQUE COMMENT 'Número da CNH (Opcional)',
  cnh_validade DATE COMMENT 'Data de validade da CNH (Opcional)',
  cnh_categoria VARCHAR(5) COMMENT 'Categoria (A, B, C, D, E) (Opcional)',
  
  -- Status e Tipo
  status ENUM('ativo', 'inativo', 'ferias') NOT NULL DEFAULT 'ativo' COMMENT 'Status atual - OBRIGATÓRIO',
  tipo ENUM('proprio', 'terceirizado', 'agregado') NOT NULL COMMENT 'Tipo de vínculo - OBRIGATÓRIO',
  
  -- Vínculo Empregatício
  data_admissao DATE COMMENT 'Data de admissão (Opcional)',
  data_desligamento DATE COMMENT 'Data de desligamento',
  
  -- Dados Bancários (Flexível: PIX ou Conta bancária — campos opcionais)
  tipo_pagamento ENUM('pix', 'transferencia_bancaria') NOT NULL DEFAULT 'pix',
  banco VARCHAR(100) NULL COMMENT 'Nome do banco (Opcional se for PIX)',
  agencia VARCHAR(10) NULL COMMENT 'Número da agência (Opcional se for PIX)',
  conta VARCHAR(20) NULL COMMENT 'Número da conta (Opcional se for PIX)',
  tipo_conta ENUM('corrente', 'poupanca') NULL DEFAULT NULL,
  chave_pix_tipo ENUM('cpf', 'email', 'telefone', 'aleatoria', 'cnpj') NULL COMMENT 'Tipo da chave PIX (Opcional)',
  chave_pix VARCHAR(255) NULL COMMENT 'Chave PIX (Opcional)',
  
  -- Métricas e Performance
  receita_gerada DECIMAL(15,2) DEFAULT 0.00,
  viagens_realizadas INT DEFAULT 0,
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices para otimização (Vírgula final removida para evitar erro 1064)
  INDEX idx_status (status),
  INDEX idx_tipo (tipo),
  INDEX idx_cpf (cpf),
  INDEX idx_cnh (cnh)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cadastro de motoristas com documentos flexíveis e financeiro rígido';

-- =============================================================================
-- Dados de Exemplo (Atualizados)
-- =============================================================================

INSERT INTO motoristas (
  id, nome, cpf, telefone, email, endereco, cnh, cnh_validade, cnh_categoria,
  status, tipo, data_admissao, tipo_pagamento, chave_pix_tipo, chave_pix,
  receita_gerada, viagens_realizadas, caminhao_atual
) VALUES
  (
    'MOT-001', 'Carlos Silva', '123.456.789-00', '(11) 98765-4321', 'carlos.silva@email.com',
    'São Paulo, SP', '12345678900', '2027-08-15', 'E',
    'ativo', 'proprio', '2020-03-15', 'pix', 'cpf', '123.456.789-00',
    89500.00, 24, 'ABC-1234' -- Frota própria
  ),
  (
    'MOT-002', 'João Oliveira', '234.567.890-11', '(21) 97654-3210', 'joao.oliveira@email.com',
    'Rio de Janeiro, RJ', '23456789011', '2026-10-22', 'E',
    'ativo', 'terceirizado', '2019-08-22', 'transferencia_bancaria', NULL, NULL,
    78200.00, 21, 'XYZ-5678' -- Frota vinculada
  ),
  (
    'MOT-003', 'Pedro Santos', '345.678.901-22', '(41) 96543-2109', 'pedro.santos@email.com',
    'Curitiba, PR', '34567890122', '2028-05-10', 'E',
    'ferias', 'proprio', '2021-01-10', 'pix', 'email', 'pedro.santos@email.com',
    72100.00, 19, 'DEF-9012'
  ),
  (
    'MOT-004', 'André Costa', '456.789.012-33', '(31) 95432-1098', 'andre.costa@email.com',
    'Belo Horizonte, MG', '45678901233', '2025-12-05', 'E',
    'ativo', 'terceirizado', '2022-06-05', 'pix', 'aleatoria', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    65800.00, 17, 'GHI-3456' -- Terceirizado
  ),
  (
    'MOT-005', 'Lucas Ferreira', '567.890.123-44', '(48) 94321-0987', 'lucas.ferreira@email.com',
    'Florianópolis, SC', '56789012344', '2029-02-18', 'E',
    'ativo', 'proprio', '2021-09-12', 'pix', 'telefone', '(48) 94321-0987',
    58900.00, 15, 'JKL-7890'
  )
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  telefone = VALUES(telefone),
  status = VALUES(status),
  -- placa_temporaria removed: no longer updated
  /* previous: placa_temporaria = VALUES(placa_temporaria); */

-- Dados bancários para João Oliveira (transferência bancária)
UPDATE motoristas
SET banco = 'Banco do Brasil', agencia = '1234', conta = '567890-1', tipo_conta = 'corrente'
WHERE id = 'MOT-002';

-- =============================================================================
-- Observações sobre a estrutura
-- =============================================================================
-- 1. CPF e CNH são UNIQUE para evitar duplicatas
-- 2. Campo 'tipo' diferencia motoristas próprios de terceirizados
-- 3. Status 'ferias' permite controle de disponibilidade
-- 4. CNH_validade com índice para alertas de vencimento
-- 5. Suporte a PIX (4 tipos de chave) e transferência bancária
-- 6. Métricas de desempenho (receita e viagens) atualizadas por triggers/backend
-- 7. Campo 'caminhao_atual' é informativo (não é FK rígida)
-- 8. Data de desligamento registra histórico sem excluir dados
-- 9. Categoria CNH é obrigatória - deve ser selecionada manualmente (não tem padrão)

-- =============================================================================
-- Queries de Exemplo
-- =============================================================================

-- Listar todos os motoristas ativos
-- SELECT id, nome, cpf, telefone, status, tipo, viagens_realizadas
-- FROM motoristas
-- WHERE status = 'ativo'
-- ORDER BY viagens_realizadas DESC;

-- Motoristas disponíveis (ativos, não em férias)
-- SELECT id, nome, telefone, tipo, caminhao_atual
-- FROM motoristas
-- WHERE status = 'ativo'
-- ORDER BY nome;

-- Motoristas com CNH próxima do vencimento (60 dias)
-- SELECT nome, cnh, cnh_validade, telefone
-- FROM motoristas
-- WHERE cnh_validade <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
--   AND cnh_validade >= CURDATE()
--   AND status != 'inativo'
-- ORDER BY cnh_validade;

-- Ranking de motoristas por receita gerada
-- SELECT nome, tipo, FORMAT(receita_gerada, 2, 'pt_BR') as receita,
--        viagens_realizadas, caminhao_atual
-- FROM motoristas
-- WHERE status = 'ativo'
-- ORDER BY receita_gerada DESC
-- LIMIT 10;

-- Buscar motorista por CPF (para validações)
-- SELECT id, nome, status, tipo
-- FROM motoristas
-- WHERE cpf = '123.456.789-00';

-- Listar motoristas por tipo
-- SELECT tipo, COUNT(*) as total,
--        SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) as ativos
-- FROM motoristas
-- GROUP BY tipo;

-- Motoristas terceirizados ativos
-- SELECT nome, telefone, email, receita_gerada
-- FROM motoristas
-- WHERE tipo = 'terceirizado' AND status = 'ativo'
-- ORDER BY nome;

-- Atualizar receita gerada (normalmente feito pelo backend após conclusão de frete)
-- UPDATE motoristas
-- SET receita_gerada = receita_gerada + 5000.00,
--     viagens_realizadas = viagens_realizadas + 1
-- WHERE id = 'MOT-001';

-- Colocar motorista em férias
-- UPDATE motoristas
-- SET status = 'ferias', updated_at = CURRENT_TIMESTAMP
-- WHERE id = 'MOT-003';

-- Desligar motorista (soft delete)
-- UPDATE motoristas
-- SET status = 'inativo', data_desligamento = CURDATE()
-- WHERE id = 'MOT-XXX';

-- Listar dados bancários para pagamento
-- SELECT nome, cpf, tipo_pagamento,
--        CASE 
--          WHEN tipo_pagamento = 'pix' THEN CONCAT(chave_pix_tipo, ': ', chave_pix)
--          ELSE CONCAT(banco, ' - Ag: ', agencia, ' - Conta: ', conta)
--        END as dados_pagamento
-- FROM motoristas
-- WHERE status = 'ativo'
-- ORDER BY nome;

-- =============================================================================
-- Triggers Sugeridos (Implementar no backend)
-- =============================================================================

-- Trigger para validar CNH categoria E ao inserir/atualizar
-- DELIMITER $$
-- CREATE TRIGGER trg_valida_pix_cpf
-- BEFORE INSERT ON motoristas
-- FOR EACH ROW
-- BEGIN
--   IF NEW.tipo_pagamento = 'pix' AND NEW.chave_pix_tipo = 'cpf' THEN
--     IF NEW.chave_pix != NEW.cpf THEN
--       SIGNAL SQLSTATE '45000'
--       SET MESSAGE_TEXT = 'Chave PIX tipo CPF deve ser igual ao CPF do motorista';
--     END IF;
--   END IF;
-- END$$
-- DELIMITER ;

-- =============================================================================
-- Manutenção
-- =============================================================================

-- Resetar contador de viagens (uso administrativo)
-- UPDATE motoristas SET viagens_realizadas = 0 WHERE id = 'MOT-XXX';

-- Limpar dados bancários
-- UPDATE motoristas 
-- SET banco = NULL, agencia = NULL, conta = NULL, tipo_conta = NULL,
--     chave_pix = NULL, chave_pix_tipo = NULL
-- WHERE id = 'MOT-XXX';
