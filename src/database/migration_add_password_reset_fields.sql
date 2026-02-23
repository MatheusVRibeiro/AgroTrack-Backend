-- Migration: Adicionar campos para recuperação de senha
-- Arquivo: migration_add_password_reset_fields.sql
-- Descrição: Adiciona as colunas token_recuperacao e token_recuperacao_expiracao na tabela usuarios

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_recuperacao VARCHAR(255) NULL UNIQUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_recuperacao_expiracao DATETIME NULL;

-- Criar índice para melhorar performance ao buscar por token
CREATE INDEX IF NOT EXISTS idx_token_recuperacao ON usuarios(token_recuperacao);
CREATE INDEX IF NOT EXISTS idx_token_recuperacao_expiracao ON usuarios(token_recuperacao_expiracao);

-- Documentação:
-- token_recuperacao: Armazena o token gerado randomicamente para resetar a senha
-- token_recuperacao_expiracao: Timestamp que define quando o token expira (1 hora após solicitação)
-- Após a senha ser resetada, ambos os campos são limpos (SET NULL)
