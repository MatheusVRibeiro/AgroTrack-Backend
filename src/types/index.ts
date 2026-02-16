import { Request } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Frota (veiculo) - campos opcionais refletem possibilidade de NULL no banco
export interface Frota {
  id: string;
  placa: string;
  placa_carreta?: string | null;
  modelo: string;
  ano_fabricacao?: number | null;
  status: string;
  motorista_fixo_id?: string | null;
  capacidade_toneladas?: number | null;
  km_atual?: number | null;
  tipo_combustivel?: string | null;
  tipo_veiculo: string;
  renavam?: string | null;
  renavam_carreta?: string | null;
  chassi?: string | null;
  registro_antt?: string | null;
  validade_seguro?: string | null;
  validade_licenciamento?: string | null;
  proprietario_tipo?: string | null;
  ultima_manutencao_data?: string | null;
  proxima_manutencao_km?: number | null;
  created_at?: string;
  updated_at?: string;
}

// Frete - registro de transporte
export interface Frete {
  id: string;
  origem: string;
  destino: string;
  motorista_id: string;
  motorista_nome: string;
  caminhao_id: string;
  caminhao_placa: string;
  ticket?: string | null;
  fazenda_id?: string | null;
  fazenda_nome?: string | null;
  mercadoria: string;
  mercadoria_id?: string | null;
  variedade?: string | null;
  data_frete: string;
  quantidade_sacas: number;
  toneladas: number;
  valor_por_tonelada: number;
  receita?: number | null;
  custos?: number | null;
  resultado?: number | null;
  pagamento_id?: string | null;
  created_at?: string;
  updated_at?: string;
}
