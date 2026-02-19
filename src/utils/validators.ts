import { z } from 'zod';

// Reusable ID schema: aceita string ou número (compatível com frontends que enviam IDs numéricos)
export const IdSchema = z.union([z.string().min(1), z.number().int().positive()]);

// ==================== FUNÇÕES DE SANITIZAÇÃO ====================
export const sanitizarCPF = (cpf: string): string => {
  return cpf.replace(/\D/g, '');
};

export const sanitizarCNH = (cnh: string): string => {
  return cnh.replace(/\D/g, '');
};

export const sanitizarTelefone = (telefone: string): string => {
  return telefone.replace(/\D/g, '');
};

// ==================== VALIDAÇÃO DE CPF ====================
export const isCPFValido = (cpf: string): boolean => {
  const limpo = cpf.replace(/\D/g, '');
  
  if (limpo.length !== 11) return false;
  
  // CPFs inválidos conhecidos (todos dígitos iguais)
  if (/^(\d)\1{10}$/.test(limpo)) return false;
  
  // Validação dos dígitos verificadores
  let soma = 0;
  let resto;
  
  // Primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(limpo.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.substring(9, 10))) return false;
  
  // Segundo dígito verificador
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(limpo.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.substring(10, 11))) return false;
  
  return true;
};

const documentoSchema = z
  .string()
  .regex(/^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})$/, 'Documento inválido')
  .refine((d) => isDocumentoValido(d), { message: 'Documento inválido (CPF/CNPJ)' });

export const sanitizarDocumento = (doc: string): string => {
  return doc.replace(/\D/g, '');
};

// ==================== VALIDAÇÃO DE DOCUMENTO (CPF / CNPJ simplificado) ====
export const isDocumentoValido = (doc: string): boolean => {
  const limpo = doc.replace(/\D/g, '');
  // aceitar CPF (11) ou CNPJ (14)
  if (limpo.length !== 11 && limpo.length !== 14) return false;
  // rejeitar sequências repetidas
  if (/^(\d)\1+$/.test(limpo)) return false;
  // validação aprofundada pode ser adicionada; aqui aceitamos formatos básicos
  return true;
};
// ==================== AUTENTICAÇÃO ====================
export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ==================== USUÁRIO ====================
export const CriarUsuarioSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export type CriarUsuarioInput = z.infer<typeof CriarUsuarioSchema>;

export const CriarUsuarioAdminSchema = z
  .object({
    id: IdSchema.optional(),
    nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email: z.string().email('Email inválido'),
    senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
    senha_hash: z.string().min(10).optional(),
    role: z.enum(['admin', 'contabilidade', 'operador']).optional(),
    ativo: z.boolean().optional(),
    telefone: z.string().min(8).optional(),
    documento: documentoSchema.optional(),
  })
  .refine((data) => data.senha || data.senha_hash, {
    message: 'Senha ou senha_hash sao obrigatorios',
    path: ['senha'],
  });

export type CriarUsuarioAdminInput = z.infer<typeof CriarUsuarioAdminSchema>;

export const AtualizarUsuarioSchema = z
  .object({
    nome: z.string().min(3).optional(),
    email: z.string().email('Email inválido').optional(),
    senha: z.string().min(6).optional(),
    senha_hash: z.string().min(10).optional(),
    role: z.enum(['admin', 'contabilidade', 'operador']).optional(),
    ativo: z.boolean().optional(),
    telefone: z.string().min(8).optional(),
    documento: documentoSchema.optional(),
    ultimo_acesso: z.string().optional(),
    tentativas_login_falhas: z.number().int().nonnegative().optional(),
    bloqueado_ate: z.string().optional(),
    token_recuperacao: z.string().optional(),
    token_expiracao: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export type AtualizarUsuarioInput = z.infer<typeof AtualizarUsuarioSchema>;

// ==================== MOTORISTA ====================
export const CriarMotoristaSchema = z.object({
  id: IdSchema.optional(),
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  documento: documentoSchema.optional().nullable(),
  telefone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('Email inválido').optional().nullable(),
  endereco: z.string().optional().nullable(),
  cnh: z.string().min(5, 'CNH inválida').optional().nullable(),
  cnh_validade: z.string().min(1, 'CNH validade obrigatoria').optional().nullable(),
  cnh_categoria: z.string().min(1, 'Categoria CNH obrigatoria').optional().nullable(),
  status: z.enum(['ativo', 'inativo', 'ferias']),
  tipo: z.enum(['proprio', 'terceirizado', 'agregado']),
  data_admissao: z.string().min(1, 'Data de admissao obrigatoria').optional().nullable(),
  data_desligamento: z.string().optional(),
  tipo_pagamento: z.enum(['pix', 'transferencia_bancaria']),
  chave_pix_tipo: z.enum(['cpf', 'email', 'telefone', 'aleatoria', 'cnpj']).optional(),
  chave_pix: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  tipo_conta: z.enum(['corrente', 'poupanca']).optional().nullable(),
  receita_gerada: z.number().nonnegative().optional(),
  viagens_realizadas: z.number().int().nonnegative().optional(),
  caminhao_atual: z.string().optional(),
  rg: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  veiculo_id: IdSchema.optional().nullable(),
});


export type CriarMotoristaInput = z.infer<typeof CriarMotoristaSchema>;

export const AtualizarMotoristaSchema = CriarMotoristaSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Informe ao menos um campo para atualizar' }
);

export type AtualizarMotoristaInput = z.infer<typeof AtualizarMotoristaSchema>;

// Atualização condicional: se alterar tipo para terceirizado/agregado, exige veiculo_id
export const AtualizarMotoristaSchemaWithVinculo = AtualizarMotoristaSchema.refine((data) => {
  if (!('tipo' in data)) return true;
  const tipo = (data as any).tipo;
  if (tipo === 'terceirizado' || tipo === 'agregado') {
    return !!(data as any).veiculo_id;
  }
  return true;
}, { message: 'Veículo obrigatório quando tipo é terceirizado/agregado', path: ['veiculo_id'] });

export type AtualizarMotoristaWithVinculoInput = z.infer<typeof AtualizarMotoristaSchemaWithVinculo>;

// ==================== CAMINHÃO ====================
export const CriarCaminhaoSchema = z.object({
  id: IdSchema.optional(),
  placa: z.string().regex(/^[A-Z]{3}-?(?:\d{4}|\d[A-Z]\d{2})$/i, 'Placa inválida'),
  placa_carreta: z.string().regex(/^[A-Z]{3}-?(?:\d{4}|\d[A-Z]\d{2})$/i, 'Placa da carreta invalida').optional().nullable(),
  modelo: z.string().min(3, 'Modelo deve ter pelo menos 3 caracteres'),
  ano_fabricacao: z.number().int().positive().optional().nullable(),
  status: z.enum(['disponivel', 'em_viagem', 'manutencao']).optional(),
  motorista_fixo_id: IdSchema.optional(),
  capacidade_toneladas: z.nullable(z.number().positive('Capacidade deve ser maior que 0')).optional(),
  km_atual: z.number().int().nonnegative().optional(),
  tipo_combustivel: z.enum(['DIESEL', 'S10', 'ARLA', 'OUTRO']).optional(),
  tipo_veiculo: z.enum(['TRUCADO', 'TOCO', 'CARRETA', 'BITREM', 'RODOTREM']),
  renavam: z.string().optional(),
  renavam_carreta: z.string().optional(),
  chassi: z.string().optional(),
  registro_antt: z.string().optional(),
  validade_seguro: z.string().optional(),
  validade_licenciamento: z.string().optional(),
  proprietario_tipo: z.enum(['PROPRIO', 'TERCEIRO', 'AGREGADO']).optional(),
  ultima_manutencao_data: z.string().optional(),
  proxima_manutencao_km: z.number().int().nonnegative().optional(),
});

// Regras adicionais para criação de motorista:
// - Se tipo for 'terceirizado' ou 'agregado', então `veiculo_id` é obrigatório no payload de criação.
export const CriarMotoristaSchemaWithVinculo = CriarMotoristaSchema.refine((data) => {
  const needsVinculo = data.tipo === 'terceirizado' || data.tipo === 'agregado';
  if (needsVinculo) {
    return !!data.veiculo_id;
  }
  return true;
}, { message: 'Veículo obrigatório para motoristas terceirizados/agregados', path: ['veiculo_id'] });

export type CriarCaminhaoInput = z.infer<typeof CriarCaminhaoSchema>;

// Validação condicional: se o tipo de veículo exige carreta, placa_carreta é obrigatória
CriarCaminhaoSchema.refine((data) => {
  const carretaTypes = ['CARRETA', 'BITREM', 'RODOTREM'];
  if (carretaTypes.includes(String(data.tipo_veiculo).toUpperCase())) {
    return !!data.placa_carreta;
  }
  return true;
}, { message: 'Placa da carreta obrigatoria para o tipo de veiculo selecionado', path: ['placa_carreta'] });

export const AtualizarCaminhaoSchema = CriarCaminhaoSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Informe ao menos um campo para atualizar' }
);

export type AtualizarCaminhaoInput = z.infer<typeof AtualizarCaminhaoSchema>;

// ==================== FRETE ====================
export const CriarFreteSchema = z.object({
  id: IdSchema.optional(),
  origem: z.string().min(3, 'Origem deve ter pelo menos 3 caracteres'),
  destino: z.string().min(3, 'Destino deve ter pelo menos 3 caracteres'),
  motorista_id: IdSchema,
  motorista_nome: z.string().min(3),
  caminhao_id: IdSchema,
  caminhao_placa: z.string().min(5),
  ticket: z.string().regex(/^\d+$/, 'Ticket deve conter apenas números').optional().nullable(),
  fazenda_id: IdSchema.optional(),
  fazenda_nome: z.string().optional(),
  mercadoria: z.string().min(1),
  mercadoria_id: IdSchema.optional(),
  variedade: z.string().optional(),
  data_frete: z.string().min(1),
  quantidade_sacas: z.number().int().positive(),
  toneladas: z.number().positive(),
  valor_por_tonelada: z.number().positive(),
  receita: z.number().positive().optional(),
  custos: z.number().nonnegative().optional(),
  resultado: z.number().optional(),
  pagamento_id: IdSchema.optional(),
});

export type CriarFreteInput = z.infer<typeof CriarFreteSchema>;

export const AtualizarFreteSchema = z
  .object({
    origem: z.string().min(3).optional(),
    destino: z.string().min(3).optional(),
    motorista_id: IdSchema.optional(),
    motorista_nome: z.string().min(3).optional(),
    caminhao_id: IdSchema.optional(),
    caminhao_placa: z.string().min(5).optional(),
    ticket: z.string().regex(/^\d+$/, 'Ticket deve conter apenas números').optional().nullable(),
    fazenda_id: IdSchema.optional(),
    fazenda_nome: z.string().optional(),
    mercadoria: z.string().min(1).optional(),
    mercadoria_id: IdSchema.optional(),
    variedade: z.string().optional(),
    data_frete: z.string().min(1).optional(),
    quantidade_sacas: z.number().int().positive().optional(),
    toneladas: z.number().positive().optional(),
    valor_por_tonelada: z.number().positive().optional(),
    receita: z.number().positive().optional(),
    custos: z.number().nonnegative().optional(),
    resultado: z.number().optional(),
    pagamento_id: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export type AtualizarFreteInput = z.infer<typeof AtualizarFreteSchema>;

// ==================== FAZENDA ====================
export const CriarFazendaSchema = z.object({
  id: IdSchema.optional(),
  fazenda: z.string().min(3),
  estado: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.enum(['SP', 'MS', 'MT'])
  ),
  proprietario: z.string().min(3),
  mercadoria: z.string().min(1),
  variedade: z.string().optional(),
  safra: z.string().min(4),
  preco_por_tonelada: z.number().positive(),
  peso_medio_saca: z.number().positive().optional(),
  total_sacas_carregadas: z.number().int().nonnegative().optional(),
  total_toneladas: z.number().nonnegative().optional(),
  faturamento_total: z.number().nonnegative().optional(),
  ultimo_frete: z.string().optional(),
  colheita_finalizada: z.boolean().optional(),
});

export type CriarFazendaInput = z.infer<typeof CriarFazendaSchema>;

export const AtualizarFazendaSchema = CriarFazendaSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Informe ao menos um campo para atualizar' }
);

export type AtualizarFazendaInput = z.infer<typeof AtualizarFazendaSchema>;

export const IncrementarVolumeSchema = z.object({
  toneladas: z.coerce.number().positive('Toneladas deve ser um número positivo'),
  quantidadeSacas: z.coerce.number().int().nonnegative().optional(),
  receitaTotal: z.coerce.number().nonnegative().optional(),
  sacas: z.coerce.number().int().nonnegative().optional(),
  quantidade_sacas: z.coerce.number().int().nonnegative().optional(),
  faturamento: z.coerce.number().nonnegative().optional(),
  faturamentoTotal: z.coerce.number().nonnegative().optional(),
  receita_total: z.coerce.number().nonnegative().optional(),
}).transform((data) => ({
  toneladas: data.toneladas,
  quantidadeSacas: data.quantidadeSacas ?? data.sacas ?? data.quantidade_sacas ?? 0,
  receitaTotal: data.receitaTotal ?? data.faturamentoTotal ?? data.faturamento ?? data.receita_total ?? 0,
}));

export type IncrementarVolumeInput = z.infer<typeof IncrementarVolumeSchema>;

// ==================== CUSTO ====================
export const CriarCustoSchema = z.object({
  id: IdSchema.optional(),
  frete_id: z.union([z.string().min(1), z.number().int().positive()]),
  tipo: z.enum(['combustivel', 'manutencao', 'pedagio', 'outros']),
  descricao: z.string().min(3),
  valor: z.number().positive(),
  data: z.string().min(1),
  comprovante: z.boolean().optional(),
  observacoes: z.string().optional(),
  motorista: z.string().optional(),
  caminhao: z.string().optional(),
  rota: z.string().optional(),
  litros: z.number().positive().optional(),
  tipo_combustivel: z.enum(['gasolina', 'diesel', 'etanol', 'gnv']).optional(),
});

export type CriarCustoInput = z.infer<typeof CriarCustoSchema>;

export const AtualizarCustoSchema = CriarCustoSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Informe ao menos um campo para atualizar' }
);

export type AtualizarCustoInput = z.infer<typeof AtualizarCustoSchema>;

// ==================== PAGAMENTO ====================
export const CriarPagamentoSchema = z.object({
  id: IdSchema.optional(),
  motorista_id: z.union([z.string().min(1), z.number().int().positive()]),
  motorista_nome: z.string().min(3),
  periodo_fretes: z.string().min(3),
  quantidade_fretes: z.number().int().positive(),
  fretes_incluidos: z.string().optional(),
  total_toneladas: z.number().positive(),
  valor_por_tonelada: z.number().positive(),
  valor_total: z.number().positive(),
  data_pagamento: z.string().min(1),
  status: z.enum(['pendente', 'processando', 'pago', 'cancelado']).optional(),
  metodo_pagamento: z.enum(['pix', 'transferencia_bancaria']),
  comprovante_nome: z.string().optional(),
  comprovante_url: z.string().optional(),
  comprovante_data_upload: z.string().optional(),
  observacoes: z.string().optional(),
});

export type CriarPagamentoInput = z.infer<typeof CriarPagamentoSchema>;

export const AtualizarPagamentoSchema = CriarPagamentoSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Informe ao menos um campo para atualizar' }
);

export type AtualizarPagamentoInput = z.infer<typeof AtualizarPagamentoSchema>;