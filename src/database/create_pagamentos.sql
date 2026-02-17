-- =============================================================================
-- Tabela: pagamentos
-- Descrição: Registro de pagamentos realizados aos motoristas
-- =============================================================================

CREATE TABLE IF NOT EXISTS pagamentos (
  -- Identificação Principal
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_pagamento VARCHAR(20) UNIQUE NULL COMMENT 'ID de negócio (Ex: PAG-2026-001)',
  
  -- Relacionamento com Motorista
  motorista_id INT NOT NULL COMMENT 'ID numérico do motorista (FK)',
  motorista_nome VARCHAR(200) NOT NULL COMMENT 'Nome do motorista (cache)',
  
  -- Período e Fretes
  periodo_fretes VARCHAR(50) NOT NULL COMMENT 'Período dos fretes (ex: 15-20/01/2026)',
  quantidade_fretes INT NOT NULL DEFAULT 1 COMMENT 'Quantidade de fretes incluídos no pagamento',
  fretes_incluidos TEXT COMMENT 'IDs dos fretes incluídos (separados por vírgula)',
  
  -- Carga Transportada
  total_toneladas DECIMAL(10,2) NOT NULL COMMENT 'Total de toneladas transportadas',
  
  -- Valores Financeiros
  valor_por_tonelada DECIMAL(10,2) NOT NULL COMMENT 'Valor unitário por tonelada',
  valor_total DECIMAL(10,2) NOT NULL COMMENT 'Valor total do pagamento',
  
  -- Data e Status do Pagamento
  data_pagamento DATE NOT NULL COMMENT 'Data prevista ou realizada do pagamento',
  status ENUM('pendente', 'processando', 'pago', 'cancelado') DEFAULT 'pendente' COMMENT 'Status do pagamento',
  
  -- Método de Pagamento
  metodo_pagamento ENUM('pix', 'transferencia_bancaria') NOT NULL COMMENT 'Método utilizado para pagamento',
  
  -- Comprovante
  comprovante_nome VARCHAR(255) COMMENT 'Nome do arquivo do comprovante',
  comprovante_url TEXT COMMENT 'URL ou caminho do comprovante',
  comprovante_data_upload TIMESTAMP COMMENT 'Data de upload do comprovante',
  
  -- Observações
  observacoes TEXT COMMENT 'Observações sobre o pagamento',
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação do registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data da última atualização',
  
  -- Foreign Keys
  FOREIGN KEY (motorista_id) REFERENCES motoristas(id) ON DELETE RESTRICT,
  
  -- Índices para otimização
  INDEX idx_motorista (motorista_id),
  INDEX idx_data_pagamento (data_pagamento),
  INDEX idx_status (status),
  INDEX idx_metodo_pagamento (metodo_pagamento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro de pagamentos realizados aos motoristas';

-- =============================================================================
-- Dados de Exemplo
-- =============================================================================

INSERT INTO pagamentos (
  id, motorista_id, motorista_nome, periodo_fretes, quantidade_fretes, fretes_incluidos,
  total_toneladas, valor_por_tonelada, valor_total, data_pagamento, status,
  metodo_pagamento, comprovante_nome, comprovante_url, comprovante_data_upload, observacoes
) VALUES
  (
    'PAG-2026-001', 'MOT-001', 'Carlos Silva', '15-20/01/2026', 2, 'FRETE-2026-001,FRETE-2026-002',
    85.00, 150.00, 12750.00, '2026-01-22', 'pago',
    'pix', 'comprovante_pix_001.pdf', '/uploads/comprovantes/comprovante_pix_001.pdf', 
    '2026-01-22 14:30:00', 'Pagamento via PIX realizado com sucesso'
  ),
  (
    'PAG-2026-002', 'MOT-002', 'João Oliveira', '18/01/2026', 1, 'FRETE-2026-003',
    45.00, 150.00, 6750.00, '2026-01-25', 'processando',
    'transferencia_bancaria', NULL, NULL, NULL, 
    'Em processamento - transferência bancária'
  ),
  (
    'PAG-2026-003', 'MOT-003', 'Pedro Santos', '17/01/2026', 1, 'FRETE-2026-004',
    40.00, 150.00, 6000.00, '2026-01-28', 'pendente',
    'pix', NULL, NULL, NULL, ''
  ),
  (
    'PAG-2026-004', 'MOT-004', 'André Costa', '12/01/2026', 1, 'FRETE-2026-005',
    55.00, 150.00, 8250.00, '2026-01-15', 'pago',
    'pix', 'comprovante_pix_004.pdf', '/uploads/comprovantes/comprovante_pix_004.pdf',
    '2026-01-15 10:15:00', 'Pagamento antecipado'
  ),
  (
    'PAG-2026-005', 'MOT-005', 'Lucas Ferreira', '05-10/01/2026', 2, 'FRETE-2026-001,FRETE-2026-003',
    92.00, 145.00, 13340.00, '2026-01-18', 'pago',
    'transferencia_bancaria', 'ted_005.pdf', '/uploads/comprovantes/ted_005.pdf',
    '2026-01-18 16:45:00', 'Transferência bancária confirmada'
  )
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  comprovante_nome = VALUES(comprovante_nome),
  comprovante_url = VALUES(comprovante_url),
  comprovante_data_upload = VALUES(comprovante_data_upload);

-- =============================================================================
-- Observações sobre a estrutura
-- =============================================================================
-- 1. `id` é numérico AUTO_INCREMENT e `codigo_pagamento` guarda o identificador de negócio (ex: PAG-2026-001).
-- 2. Foreign Key para `motoristas` com `RESTRICT` (não permite excluir motorista com pagamentos).
-- 3. Campo `motorista_nome` é cache para evitar JOINs desnecessários em relatórios.
-- 4. `fretes_incluidos` armazena IDs de negócio dos fretes separados por vírgula (ex: 'FRT-2026-001,FRT-2026-002').
-- 5. `periodo_fretes` é textual para flexibilidade (ex: '15-20/01/2026' ou '18/01/2026').
-- 6. `total_toneladas` é a soma das toneladas de todos os fretes incluídos; `valor_total` = total_toneladas × valor_por_tonelada.
-- 7. Status: 'pendente' → 'processando' → 'pago' ou 'cancelado'.
-- 8. Comprovante é opcional (apenas para pagamentos concluídos) e ao subir comprovante o status pode ser atualizado.
-- 9. FLUXO SEMANAL: Ao criar pagamento, seleciona-se motorista e sistema retorna apenas fretes não pagos.
-- 10. Quando pagamento é criado, o backend deve atualizar os fretes incluídos com `pagamento_id`.

-- =============================================================================
-- Queries e Triggers de Exemplo
-- =============================================================================
-- Fluxo de pagamento semanal: listar motoristas com fretes pendentes
-- SELECT m.id, m.nome,
--        COUNT(f.id) as total_fretes_pendentes,
--        SUM(f.toneladas) as total_toneladas,
--        SUM(f.resultado) as total_a_pagar,
--        MIN(f.data_frete) as frete_mais_antigo,
--        MAX(f.data_frete) as frete_mais_recente
-- FROM motoristas m
-- INNER JOIN fretes f ON m.id = f.motorista_id
-- WHERE f.pagamento_id IS NULL
-- GROUP BY m.id, m.nome
-- ORDER BY total_a_pagar DESC;

-- Trigger sugerido (documentação): depois de inserir pagamento, atualizar fretes vinculados
-- DELIMITER $$
-- CREATE TRIGGER trg_vincula_fretes_pagamento
-- AFTER INSERT ON pagamentos
-- FOR EACH ROW
-- BEGIN
--   UPDATE fretes
--   SET pagamento_id = NEW.id
--   WHERE FIND_IN_SET(codigo_frete, NEW.fretes_incluidos) > 0;
-- END$$
-- DELIMITER ;

-- =============================================================================
-- Queries de Exemplo
-- =============================================================================

-- FLUXO DE PAGAMENTO SEMANAL: Listar motoristas com fretes pendentes
-- SELECT m.id, m.nome,
--        COUNT(f.id) as total_fretes_pendentes,
--        SUM(f.toneladas) as total_toneladas,
--        SUM(f.resultado) as total_a_pagar,
--        MIN(f.data_frete) as frete_mais_antigo,
--        MAX(f.data_frete) as frete_mais_recente
-- FROM motoristas m
-- INNER JOIN fretes f ON m.id = f.motorista_id
-- WHERE f.pagamento_id IS NULL
-- GROUP BY m.id, m.nome
-- ORDER BY total_a_pagar DESC;

-- FLUXO: Buscar fretes não pagos de um motorista específico (para criar pagamento)
-- SELECT id, origem, destino, data_frete,
--        quantidade_sacas, toneladas,
--        FORMAT(receita, 2, 'pt_BR') as receita,
--        FORMAT(custos, 2, 'pt_BR') as custos,
--        FORMAT(resultado, 2, 'pt_BR') as resultado
-- FROM fretes
-- WHERE motorista_id = 'MOT-001' AND pagamento_id IS NULL
-- ORDER BY data_frete ASC;

-- Listar todos os pagamentos
-- SELECT id, motorista_nome, periodo_fretes, quantidade_fretes,
--        FORMAT(total_toneladas, 2, 'pt_BR') as toneladas,
--        FORMAT(valor_por_tonelada, 2, 'pt_BR') as valor_unitario,
--        FORMAT(valor_total, 2, 'pt_BR') as valor_total,
--        data_pagamento, status, metodo_pagamento
-- FROM pagamentos
-- ORDER BY data_pagamento DESC;

-- Pagamentos pendentes
-- SELECT id, motorista_nome, periodo_fretes,
--        FORMAT(valor_total, 2, 'pt_BR') as valor,
--        data_pagamento
-- FROM pagamentos
-- WHERE status = 'pendente'
-- ORDER BY data_pagamento ASC;

-- Pagamentos por motorista
-- SELECT motorista_nome,
--        COUNT(*) as total_pagamentos,
--        SUM(total_toneladas) as total_toneladas,
--        SUM(valor_total) as valor_total_pago,
--        AVG(valor_por_tonelada) as media_valor_tonelada
-- FROM pagamentos
-- WHERE status = 'pago'
-- GROUP BY motorista_id, motorista_nome
-- ORDER BY valor_total_pago DESC;

-- Total pago por período
-- SELECT DATE_FORMAT(data_pagamento, '%Y-%m') as mes_ano,
--        COUNT(*) as total_pagamentos,
--        SUM(valor_total) as total_pago,
--        AVG(valor_por_tonelada) as media_valor_tonelada
-- FROM pagamentos
-- WHERE status = 'pago'
-- GROUP BY mes_ano
-- ORDER BY mes_ano DESC;

-- Pagamentos com comprovante
-- SELECT id, motorista_nome, FORMAT(valor_total, 2, 'pt_BR') as valor,
--        data_pagamento, comprovante_nome,
--        DATE_FORMAT(comprovante_data_upload, '%d/%m/%Y %H:%i') as data_upload
-- FROM pagamentos
-- WHERE comprovante_nome IS NOT NULL
-- ORDER BY comprovante_data_upload DESC;

-- Pagamentos sem comprovante (pagos)
-- SELECT id, motorista_nome, FORMAT(valor_total, 2, 'pt_BR') as valor,
--        data_pagamento, DATEDIFF(NOW(), data_pagamento) as dias_sem_comprovante
-- FROM pagamentos
-- WHERE status = 'pago' AND comprovante_nome IS NULL
-- ORDER BY data_pagamento ASC;

-- Total a pagar (pendentes + processando)
-- SELECT SUM(valor_total) as total_a_pagar,
--        COUNT(*) as quantidade_pendente
-- FROM pagamentos
-- WHERE status IN ('pendente', 'processando');

-- Análise por método de pagamento
-- SELECT metodo_pagamento,
--        COUNT(*) as total_pagamentos,
--        SUM(valor_total) as valor_total,
--        AVG(valor_total) as media_pagamento
-- FROM pagamentos
-- WHERE status = 'pago'
-- GROUP BY metodo_pagamento;

-- Pagamentos cancelados
-- SELECT id, motorista_nome, periodo_fretes,
--        FORMAT(valor_total, 2, 'pt_BR') as valor,
--        data_pagamento, observacoes
-- FROM pagamentos
-- WHERE status = 'cancelado'
-- ORDER BY data_pagamento DESC;

-- Atualizar status do pagamento
-- UPDATE pagamentos
-- SET status = 'pago',
--     comprovante_nome = 'comprovante.pdf',
--     comprovante_url = '/uploads/comprovante.pdf',
--     comprovante_data_upload = NOW()
-- WHERE id = 'PAG-2026-003';

-- Cancelar pagamento
-- UPDATE pagamentos
-- SET status = 'cancelado',
--     observacoes = 'Cancelado por solicitação do motorista'
-- WHERE id = 'PAG-2026-XXX';

-- Buscar pagamentos de um motorista
-- SELECT id, periodo_fretes, quantidade_fretes,
--        FORMAT(valor_total, 2, 'pt_BR') as valor,
--        data_pagamento, status
-- FROM pagamentos
-- WHERE motorista_id = 'MOT-001'
-- ORDER BY data_pagamento DESC;

-- Pagamentos do mês atual
-- SELECT id, motorista_nome, FORMAT(valor_total, 2, 'pt_BR') as valor,
--        data_pagamento, status
-- FROM pagamentos
-- WHERE YEAR(data_pagamento) = YEAR(NOW())
--   AND MONTH(data_pagamento) = MONTH(NOW())
-- ORDER BY data_pagamento DESC;

-- Média de pagamento por motorista
-- SELECT motorista_nome,
--        COUNT(*) as quantidade_pagamentos,
--        AVG(valor_total) as media_pagamento,
--        MIN(valor_total) as menor_pagamento,
--        MAX(valor_total) as maior_pagamento
-- FROM pagamentos
-- WHERE status = 'pago'
-- GROUP BY motorista_id, motorista_nome
-- ORDER BY media_pagamento DESC;

-- =============================================================================
-- Triggers para Manutenção Automática
-- =============================================================================

-- Trigger para vincular fretes ao pagamento quando pagamento é criado
-- DELIMITER $$
-- CREATE TRIGGER trg_vincula_fretes_pagamento
-- AFTER INSERT ON pagamentos
-- FOR EACH ROW
-- BEGIN
--   -- Atualizar pagamento_id nos fretes incluídos
--   UPDATE fretes
--   SET pagamento_id = NEW.id
--   WHERE FIND_IN_SET(id, NEW.fretes_incluidos) > 0;
-- END$$
-- DELIMITER ;

-- Trigger para remover vínculo de fretes quando pagamento é cancelado
-- DELIMITER $$
-- CREATE TRIGGER trg_desvincula_fretes_cancelamento
-- AFTER UPDATE ON pagamentos
-- FOR EACH ROW
-- BEGIN
--   IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
--     UPDATE fretes
--     SET pagamento_id = NULL
--     WHERE pagamento_id = NEW.id;
--   END IF;
-- END$$
-- DELIMITER ;

-- Trigger para validar método de pagamento com cadastro do motorista
-- DELIMITER $$
-- CREATE TRIGGER trg_valida_metodo_pagamento
-- BEFORE INSERT ON pagamentos
-- FOR EACH ROW
-- BEGIN
--   DECLARE metodo_cadastrado VARCHAR(50);
--   
--   SELECT tipo_pagamento INTO metodo_cadastrado
--   FROM motoristas
--   WHERE id = NEW.motorista_id;
--   
--   IF metodo_cadastrado != NEW.metodo_pagamento THEN
--     SIGNAL SQLSTATE '45000'
--     SET MESSAGE_TEXT = 'Método de pagamento não corresponde ao cadastrado para o motorista';
--   END IF;
-- END$$
-- DELIMITER ;

-- Trigger para atualizar status automaticamente quando comprovante é adicionado
-- DELIMITER $$
-- CREATE TRIGGER trg_atualiza_status_comprovante
-- BEFORE UPDATE ON pagamentos
-- FOR EACH ROW
-- BEGIN
--   IF NEW.comprovante_nome IS NOT NULL AND OLD.comprovante_nome IS NULL THEN
--     IF NEW.status = 'processando' THEN
--       SET NEW.status = 'pago';
--     END IF;
--   END IF;
-- END$$
-- DELIMITER ;

-- =============================================================================
-- Views Úteis
-- =============================================================================

-- View: Resumo de pagamentos com informações do motorista
-- CREATE OR REPLACE VIEW vw_pagamentos_completo AS
-- SELECT 
--   p.id, p.motorista_nome, p.periodo_fretes,
--   p.quantidade_fretes, p.fretes_incluidos,
--   p.total_toneladas, p.valor_por_tonelada, p.valor_total,
--   p.data_pagamento, p.status, p.metodo_pagamento,
--   p.comprovante_nome, p.observacoes,
--   m.telefone as motorista_telefone,
--   m.tipo as motorista_tipo,
--   CASE 
--     WHEN m.tipo_pagamento = 'pix' THEN CONCAT(m.chave_pix_tipo, ': ', m.chave_pix)
--     ELSE CONCAT(m.banco, ' - Ag: ', m.agencia, ' Cc: ', m.conta)
--   END as dados_pagamento
-- FROM pagamentos p
-- INNER JOIN motoristas m ON p.motorista_id = m.id;

-- View: Dashboard de pagamentos
-- CREATE OR REPLACE VIEW vw_dashboard_pagamentos AS
-- SELECT 
--   (SELECT COUNT(*) FROM pagamentos WHERE status = 'pendente') as pendentes,
--   (SELECT COUNT(*) FROM pagamentos WHERE status = 'processando') as processando,
--   (SELECT COUNT(*) FROM pagamentos WHERE status = 'pago') as pagos,
--   (SELECT SUM(valor_total) FROM pagamentos WHERE status = 'pendente') as total_pendente,
--   (SELECT SUM(valor_total) FROM pagamentos WHERE status = 'processando') as total_processando,
--   (SELECT SUM(valor_total) FROM pagamentos WHERE status = 'pago' 
--    AND MONTH(data_pagamento) = MONTH(NOW()) 
--    AND YEAR(data_pagamento) = YEAR(NOW())) as total_pago_mes_atual;

-- =============================================================================
-- Relatórios e Análises
-- =============================================================================

-- Análise de inadimplência (pagamentos atrasados)
-- SELECT id, motorista_nome, periodo_fretes,
--        FORMAT(valor_total, 2, 'pt_BR') as valor,
--        data_pagamento,
--        DATEDIFF(NOW(), data_pagamento) as dias_atraso
-- FROM pagamentos
-- WHERE status IN ('pendente', 'processando')
--   AND data_pagamento < CURDATE()
-- ORDER BY dias_atraso DESC;

-- Fluxo de caixa (pagamentos por dia)
-- SELECT data_pagamento,
--        COUNT(*) as quantidade,
--        SUM(valor_total) as total_dia
-- FROM pagamentos
-- WHERE status = 'pago'
--   AND data_pagamento >= DATE_SUB(NOW(), INTERVAL 30 DAY)
-- GROUP BY data_pagamento
-- ORDER BY data_pagamento DESC;

-- Top motoristas por valor recebido
-- SELECT motorista_nome,
--        COUNT(*) as total_pagamentos,
--        SUM(valor_total) as total_recebido,
--        SUM(total_toneladas) as total_toneladas_transportadas
-- FROM pagamentos
-- WHERE status = 'pago'
-- GROUP BY motorista_id, motorista_nome
-- ORDER BY total_recebido DESC
-- LIMIT 10;

-- Relatório de pagamentos semanais (por semana do ano)
-- SELECT 
--   YEAR(data_pagamento) as ano,
--   WEEK(data_pagamento, 1) as semana,
--   COUNT(*) as total_pagamentos,
--   SUM(valor_total) as total_pago,
--   COUNT(DISTINCT motorista_id) as total_motoristas
-- FROM pagamentos
-- WHERE status = 'pago'
-- GROUP BY ano, semana
-- ORDER BY ano DESC, semana DESC
-- LIMIT 12;

-- =============================================================================
-- Manutenção
-- =============================================================================

-- Limpar comprovantes de pagamentos cancelados
-- UPDATE pagamentos
-- SET comprovante_nome = NULL,
--     comprovante_url = NULL,
--     comprovante_data_upload = NULL
-- WHERE status = 'cancelado';

-- Marcar pagamentos atrasados
-- UPDATE pagamentos
-- SET observacoes = CONCAT(observacoes, ' [PAGAMENTO ATRASADO]')
-- WHERE status = 'pendente'
--   AND data_pagamento < CURDATE()
--   AND observacoes NOT LIKE '%ATRASADO%';
