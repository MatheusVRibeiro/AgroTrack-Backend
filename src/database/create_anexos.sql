-- =============================================================================
-- TABELA: anexos (Gerencia uploads e PDFs do sistema)
-- =============================================================================
CREATE TABLE IF NOT EXISTS anexos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_anexo VARCHAR(20) UNIQUE NULL COMMENT 'ID de negócio (Ex: ANX-2026-001)',
  nome_original VARCHAR(500) NOT NULL COMMENT 'Nome original do arquivo enviado',
  nome_arquivo VARCHAR(500) NOT NULL COMMENT 'Nome único do arquivo no servidor (timestamp)',
  url VARCHAR(1000) NOT NULL COMMENT 'URL para acesso ao arquivo (/uploads/...)',
  tipo_mime VARCHAR(100) NOT NULL COMMENT 'MIME type do arquivo (image/jpeg, application/pdf)',
  tamanho INT NOT NULL COMMENT 'Tamanho do arquivo em bytes',
  entidade_tipo VARCHAR(50) NOT NULL COMMENT 'Tipo da entidade (pagamento, frete, custo, etc)',
  entidade_id INT NOT NULL COMMENT 'ID numérico da entidade vinculada',
  observacoes TEXT COMMENT 'Observações sobre o anexo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data/hora do upload',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_entidade (entidade_tipo, entidade_id),
  INDEX idx_tipo_mime (tipo_mime),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Armazenamento de anexos (comprovantes, notas fiscais, fotos, etc)';

-- =============================================================================
-- Observações e Exemplos
-- =============================================================================
-- 1. `id` é numérico AUTO_INCREMENT; `codigo_anexo` guarda o ID de negócio quando necessário.
-- 2. `entidade_tipo` diferencia a entidade vinculada: 'PAGAMENTO', 'FRETE', 'CUSTO', 'USUARIO', etc.
-- 3. `entidade_id` é numérico e deve corresponder ao `id` da tabela referenciada.
-- 4. Armazenamento de arquivos deve usar diretório protegido e `url` salvo relativo a `/uploads`.

-- Exemplo de inserção de comprovante de pagamento
-- INSERT INTO anexos (codigo_anexo, nome_original, nome_arquivo, url, tipo_mime, tamanho, entidade_tipo, entidade_id, created_at)
-- VALUES ('ANX-2026-001', 'comprovante_pix_001.pdf', 'comprovante_pix_001_1670000000.pdf', '/uploads/comprovantes/comprovante_pix_001_1670000000.pdf', 'application/pdf', 245321, 'PAGAMENTO', 1, CURRENT_TIMESTAMP);
