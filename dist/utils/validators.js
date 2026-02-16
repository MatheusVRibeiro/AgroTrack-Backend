"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtualizarLocalEntregaSchema = exports.CriarLocalEntregaSchema = exports.AtualizarNotaFiscalSchema = exports.CriarNotaFiscalSchema = exports.AtualizarPagamentoSchema = exports.CriarPagamentoSchema = exports.AtualizarCustoSchema = exports.CriarCustoSchema = exports.IncrementarVolumeSchema = exports.AtualizarFazendaSchema = exports.CriarFazendaSchema = exports.AtualizarFreteSchema = exports.CriarFreteSchema = exports.AtualizarCaminhaoSchema = exports.CriarCaminhaoSchema = exports.AtualizarMotoristaSchema = exports.CriarMotoristaSchema = exports.AtualizarUsuarioSchema = exports.CriarUsuarioAdminSchema = exports.CriarUsuarioSchema = exports.LoginSchema = exports.isCPFValido = exports.sanitizarTelefone = exports.sanitizarCNH = exports.sanitizarCPF = void 0;
const zod_1 = require("zod");
// ==================== FUNÇÕES DE SANITIZAÇÃO ====================
const sanitizarCPF = (cpf) => {
    return cpf.replace(/\D/g, '');
};
exports.sanitizarCPF = sanitizarCPF;
const sanitizarCNH = (cnh) => {
    return cnh.replace(/\D/g, '');
};
exports.sanitizarCNH = sanitizarCNH;
const sanitizarTelefone = (telefone) => {
    return telefone.replace(/\D/g, '');
};
exports.sanitizarTelefone = sanitizarTelefone;
// ==================== VALIDAÇÃO DE CPF ====================
const isCPFValido = (cpf) => {
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11)
        return false;
    // CPFs inválidos conhecidos (todos dígitos iguais)
    if (/^(\d)\1{10}$/.test(limpo))
        return false;
    // Validação dos dígitos verificadores
    let soma = 0;
    let resto;
    // Primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
        soma += parseInt(limpo.substring(i - 1, i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11)
        resto = 0;
    if (resto !== parseInt(limpo.substring(9, 10)))
        return false;
    // Segundo dígito verificador
    soma = 0;
    for (let i = 1; i <= 10; i++) {
        soma += parseInt(limpo.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11)
        resto = 0;
    if (resto !== parseInt(limpo.substring(10, 11)))
        return false;
    return true;
};
exports.isCPFValido = isCPFValido;
const cpfSchema = zod_1.z
    .string()
    .regex(/^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})$/, 'CPF invalido')
    .refine((cpf) => (0, exports.isCPFValido)(cpf), { message: 'CPF inválido para os padrões da Receita Federal' });
// ==================== AUTENTICAÇÃO ====================
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email inválido'),
    senha: zod_1.z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});
// ==================== USUÁRIO ====================
exports.CriarUsuarioSchema = zod_1.z.object({
    nome: zod_1.z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email: zod_1.z.string().email('Email inválido'),
    senha: zod_1.z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});
exports.CriarUsuarioAdminSchema = zod_1.z
    .object({
    id: zod_1.z.string().min(1).optional(),
    nome: zod_1.z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email: zod_1.z.string().email('Email inválido'),
    senha: zod_1.z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
    senha_hash: zod_1.z.string().min(10).optional(),
    role: zod_1.z.enum(['admin', 'contabilidade', 'operador']).optional(),
    ativo: zod_1.z.boolean().optional(),
    telefone: zod_1.z.string().min(8).optional(),
    cpf: cpfSchema.optional(),
})
    .refine((data) => data.senha || data.senha_hash, {
    message: 'Senha ou senha_hash sao obrigatorios',
    path: ['senha'],
});
exports.AtualizarUsuarioSchema = zod_1.z
    .object({
    nome: zod_1.z.string().min(3).optional(),
    email: zod_1.z.string().email('Email inválido').optional(),
    senha: zod_1.z.string().min(6).optional(),
    senha_hash: zod_1.z.string().min(10).optional(),
    role: zod_1.z.enum(['admin', 'contabilidade', 'operador']).optional(),
    ativo: zod_1.z.boolean().optional(),
    telefone: zod_1.z.string().min(8).optional(),
    cpf: cpfSchema.optional(),
    ultimo_acesso: zod_1.z.string().optional(),
    tentativas_login_falhas: zod_1.z.number().int().nonnegative().optional(),
    bloqueado_ate: zod_1.z.string().optional(),
    token_recuperacao: zod_1.z.string().optional(),
    token_expiracao: zod_1.z.string().optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
});
// ==================== MOTORISTA ====================
exports.CriarMotoristaSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    nome: zod_1.z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    cpf: cpfSchema,
    telefone: zod_1.z.string().min(10, 'Telefone inválido'),
    email: zod_1.z.string().email('Email inválido'),
    endereco: zod_1.z.string().optional(),
    cnh: zod_1.z.string().min(5, 'CNH inválida'),
    cnh_validade: zod_1.z.string().min(1, 'CNH validade obrigatoria'),
    cnh_categoria: zod_1.z.string().min(1, 'Categoria CNH obrigatoria'),
    status: zod_1.z.enum(['ativo', 'inativo', 'ferias']).optional(),
    tipo: zod_1.z.enum(['proprio', 'terceirizado']),
    data_admissao: zod_1.z.string().min(1, 'Data de admissao obrigatoria'),
    data_desligamento: zod_1.z.string().optional(),
    tipo_pagamento: zod_1.z.enum(['pix', 'transferencia_bancaria']).optional(),
    chave_pix_tipo: zod_1.z.enum(['cpf', 'email', 'telefone', 'aleatoria']).optional(),
    chave_pix: zod_1.z.string().optional(),
    banco: zod_1.z.string().optional(),
    agencia: zod_1.z.string().optional(),
    conta: zod_1.z.string().optional(),
    tipo_conta: zod_1.z.enum(['corrente', 'poupanca']).optional(),
    receita_gerada: zod_1.z.number().nonnegative().optional(),
    viagens_realizadas: zod_1.z.number().int().nonnegative().optional(),
    caminhao_atual: zod_1.z.string().optional(),
    placa_temporaria: zod_1.z.string().regex(/^[A-Z]{3}-?\d{4}$/, 'Placa inválida').optional(),
});
exports.AtualizarMotoristaSchema = exports.CriarMotoristaSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });
// ==================== CAMINHÃO ====================
exports.CriarCaminhaoSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    placa: zod_1.z.string().regex(/^[A-Z]{3}-?\d{4}$/, 'Placa inválida'),
    placa_carreta: zod_1.z.string().optional(),
    modelo: zod_1.z.string().min(3, 'Modelo deve ter pelo menos 3 caracteres'),
    ano_fabricacao: zod_1.z.number().int().positive(),
    status: zod_1.z.enum(['disponivel', 'em_viagem', 'manutencao']).optional(),
    motorista_fixo_id: zod_1.z.string().optional(),
    capacidade_toneladas: zod_1.z.number().positive('Capacidade deve ser maior que 0'),
    km_atual: zod_1.z.number().int().nonnegative().optional(),
    tipo_combustivel: zod_1.z.enum(['DIESEL', 'S10', 'ARLA', 'OUTRO']).optional(),
    tipo_veiculo: zod_1.z.enum(['TRUCADO', 'TOCO', 'CARRETA', 'BITREM', 'RODOTREM']),
    renavam: zod_1.z.string().optional(),
    renavam_carreta: zod_1.z.string().optional(),
    chassi: zod_1.z.string().optional(),
    registro_antt: zod_1.z.string().optional(),
    validade_seguro: zod_1.z.string().optional(),
    validade_licenciamento: zod_1.z.string().optional(),
    proprietario_tipo: zod_1.z.enum(['PROPRIO', 'TERCEIRO', 'AGREGADO']).optional(),
    ultima_manutencao_data: zod_1.z.string().optional(),
    proxima_manutencao_km: zod_1.z.number().int().nonnegative().optional(),
});
exports.AtualizarCaminhaoSchema = exports.CriarCaminhaoSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });
// ==================== FRETE ====================
exports.CriarFreteSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    origem: zod_1.z.string().min(3, 'Origem deve ter pelo menos 3 caracteres'),
    destino: zod_1.z.string().min(3, 'Destino deve ter pelo menos 3 caracteres'),
    motorista_id: zod_1.z.string().min(1),
    motorista_nome: zod_1.z.string().min(3),
    caminhao_id: zod_1.z.string().min(1),
    caminhao_placa: zod_1.z.string().min(5),
    fazenda_id: zod_1.z.string().optional(),
    fazenda_nome: zod_1.z.string().optional(),
    mercadoria: zod_1.z.string().min(1),
    mercadoria_id: zod_1.z.string().optional(),
    variedade: zod_1.z.string().optional(),
    data_frete: zod_1.z.string().min(1),
    quantidade_sacas: zod_1.z.number().int().positive(),
    toneladas: zod_1.z.number().positive(),
    valor_por_tonelada: zod_1.z.number().positive(),
    receita: zod_1.z.number().positive().optional(),
    custos: zod_1.z.number().nonnegative().optional(),
    resultado: zod_1.z.number().optional(),
    pagamento_id: zod_1.z.string().optional(),
});
exports.AtualizarFreteSchema = zod_1.z
    .object({
    origem: zod_1.z.string().min(3).optional(),
    destino: zod_1.z.string().min(3).optional(),
    motorista_id: zod_1.z.string().min(1).optional(),
    motorista_nome: zod_1.z.string().min(3).optional(),
    caminhao_id: zod_1.z.string().min(1).optional(),
    caminhao_placa: zod_1.z.string().min(5).optional(),
    fazenda_id: zod_1.z.string().optional(),
    fazenda_nome: zod_1.z.string().optional(),
    mercadoria: zod_1.z.string().min(1).optional(),
    mercadoria_id: zod_1.z.string().optional(),
    variedade: zod_1.z.string().optional(),
    data_frete: zod_1.z.string().min(1).optional(),
    quantidade_sacas: zod_1.z.number().int().positive().optional(),
    toneladas: zod_1.z.number().positive().optional(),
    valor_por_tonelada: zod_1.z.number().positive().optional(),
    receita: zod_1.z.number().positive().optional(),
    custos: zod_1.z.number().nonnegative().optional(),
    resultado: zod_1.z.number().optional(),
    pagamento_id: zod_1.z.string().optional(),
})
    .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
});
// ==================== FAZENDA ====================
exports.CriarFazendaSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    fazenda: zod_1.z.string().min(3),
    localizacao: zod_1.z.string().min(3),
    proprietario: zod_1.z.string().min(3),
    mercadoria: zod_1.z.string().min(1),
    variedade: zod_1.z.string().optional(),
    safra: zod_1.z.string().min(4),
    preco_por_tonelada: zod_1.z.number().positive(),
    peso_medio_saca: zod_1.z.number().positive().optional(),
    total_sacas_carregadas: zod_1.z.number().int().nonnegative().optional(),
    total_toneladas: zod_1.z.number().nonnegative().optional(),
    faturamento_total: zod_1.z.number().nonnegative().optional(),
    ultimo_frete: zod_1.z.string().optional(),
    colheita_finalizada: zod_1.z.boolean().optional(),
});
exports.AtualizarFazendaSchema = exports.CriarFazendaSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });
exports.IncrementarVolumeSchema = zod_1.z.object({
    toneladas: zod_1.z.number().positive('Toneladas deve ser um número positivo'),
});
// ==================== CUSTO ====================
exports.CriarCustoSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    frete_id: zod_1.z.string().min(1),
    tipo: zod_1.z.enum(['combustivel', 'manutencao', 'pedagio', 'outros']),
    descricao: zod_1.z.string().min(3),
    valor: zod_1.z.number().positive(),
    data: zod_1.z.string().min(1),
    comprovante: zod_1.z.boolean().optional(),
    observacoes: zod_1.z.string().optional(),
    motorista: zod_1.z.string().optional(),
    caminhao: zod_1.z.string().optional(),
    rota: zod_1.z.string().optional(),
    litros: zod_1.z.number().positive().optional(),
    tipo_combustivel: zod_1.z.enum(['gasolina', 'diesel', 'etanol', 'gnv']).optional(),
});
exports.AtualizarCustoSchema = exports.CriarCustoSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });
// ==================== PAGAMENTO ====================
exports.CriarPagamentoSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    motorista_id: zod_1.z.string().min(1),
    motorista_nome: zod_1.z.string().min(3),
    periodo_fretes: zod_1.z.string().min(3),
    quantidade_fretes: zod_1.z.number().int().positive(),
    fretes_incluidos: zod_1.z.string().optional(),
    total_toneladas: zod_1.z.number().positive(),
    valor_por_tonelada: zod_1.z.number().positive(),
    valor_total: zod_1.z.number().positive(),
    data_pagamento: zod_1.z.string().min(1),
    status: zod_1.z.enum(['pendente', 'processando', 'pago', 'cancelado']).optional(),
    metodo_pagamento: zod_1.z.enum(['pix', 'transferencia_bancaria']),
    comprovante_nome: zod_1.z.string().optional(),
    comprovante_url: zod_1.z.string().optional(),
    comprovante_data_upload: zod_1.z.string().optional(),
    observacoes: zod_1.z.string().optional(),
});
exports.AtualizarPagamentoSchema = exports.CriarPagamentoSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });
// ==================== NOTA FISCAL ====================
exports.CriarNotaFiscalSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    frete_id: zod_1.z.string().min(1),
    motorista_id: zod_1.z.string().min(1),
    numero_nf: zod_1.z.number().int().positive(),
    serie_nf: zod_1.z.string().min(1).optional(),
    data_emissao: zod_1.z.string().min(1),
    data_saida: zod_1.z.string().optional(),
    data_entrega: zod_1.z.string().optional(),
    mercadoria: zod_1.z.string().min(1),
    quantidade_sacas: zod_1.z.number().int().positive(),
    toneladas: zod_1.z.number().positive(),
    origem: zod_1.z.string().min(2),
    destino: zod_1.z.string().min(2),
    valor_bruto: zod_1.z.number().positive(),
    icms_aliquota: zod_1.z.number().positive().optional(),
    icms_valor: zod_1.z.number().nonnegative().optional(),
    valor_liquido: zod_1.z.number().nonnegative().optional(),
    status: zod_1.z.enum(['emitida', 'cancelada', 'devolvida']).optional(),
    chave_acesso: zod_1.z.string().length(44).optional(),
    arquivo_pdf: zod_1.z.string().optional(),
    arquivo_xml: zod_1.z.string().optional(),
    observacoes: zod_1.z.string().optional(),
});
exports.AtualizarNotaFiscalSchema = exports.CriarNotaFiscalSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });
// ==================== LOCAIS DE ENTREGA ====================
exports.CriarLocalEntregaSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    nome: zod_1.z.string().min(3),
    cidade: zod_1.z.string().min(2),
    estado: zod_1.z.string().length(2),
    ativo: zod_1.z.boolean().optional(),
});
exports.AtualizarLocalEntregaSchema = exports.CriarLocalEntregaSchema.partial().refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo para atualizar' });
//# sourceMappingURL=validators.js.map