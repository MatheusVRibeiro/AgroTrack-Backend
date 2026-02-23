import { CriarMotoristaSchemaWithVinculo } from './src/utils/validators';

const payload = {
  nome: 'MATHEUS VINICIUS',
  telefone: '14998958124',
  tipo: 'terceirizado',
  status: 'ativo',
  tipo_pagamento: 'pix',
  chave_pix: 'joaoped@teste.com',
  chave_pix_tipo: 'email'
};

try {
  CriarMotoristaSchemaWithVinculo.parse(payload);
  console.log("Success");
} catch (e: any) {
  console.error(e.errors);
}
