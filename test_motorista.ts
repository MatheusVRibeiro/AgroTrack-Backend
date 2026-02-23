import { z } from "zod";

const IdSchema = z.union([z.string().min(1), z.number().int().positive()]);
const isDocumentoValido = (_doc: string): boolean => true;
const documentoSchema = z
  .string()
  .regex(/^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})$/, 'Documento inválido')
  .refine((d) => isDocumentoValido(d), { message: 'Documento inválido (CPF/CNPJ)' });

const CriarMotoristaSchema = z.object({
  id: IdSchema.optional(),
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').transform(v => v.toUpperCase()),
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

const cleanedRequest = {
  nome: "MATHEUS VINICIUS",
  telefone: "14998958124",
  tipo: "terceirizado",
  status: "ativo",
  tipo_pagamento: "pix",
  chave_pix: "joaoped@teste.com",
  chave_pix_tipo: "email"
};

try {
  CriarMotoristaSchema.parse(cleanedRequest);
  console.log("SUCCESS");
} catch (e: any) {
  console.log(JSON.stringify(e.errors, null, 2));
}
