export function normalizeCaminhaoPayload(input: any) {
  const out: any = { ...input };

  // Placa: trim, uppercase, remove non-alphanumerics then insert dash after letters
  const formatPlaca = (p: string) => {
    const cleaned = p.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Mercosul pattern: AAA9A99 (letters(3) + digit + letter + 2 digits)
    const merc = cleaned.match(/^([A-Z]{3})(\d[A-Z]\d{2})$/);
    if (merc) return `${merc[1]}-${merc[2]}`;
    // Old pattern: AAA9999
    const old = cleaned.match(/^([A-Z]{3})(\d{4})$/);
    if (old) return `${old[1]}-${old[2]}`;
    // otherwise return as uppercase cleaned (best effort)
    return cleaned;
  };

  if (typeof out.placa === 'string') {
    out.placa = formatPlaca(out.placa);
  }

  if (typeof out.placa_carreta === 'string') {
    out.placa_carreta = formatPlaca(out.placa_carreta);
  }

  // Capacidade: convert empty string to null, ensure number when present
  if (out.capacidade_toneladas === '' || out.capacidade_toneladas === undefined) {
    out.capacidade_toneladas = null;
  } else if (typeof out.capacidade_toneladas === 'string') {
    const n = Number(out.capacidade_toneladas.replace(',', '.'));
    out.capacidade_toneladas = Number.isNaN(n) ? null : n;
  }

  // km_atual: same handling
  if (out.km_atual === '' || out.km_atual === undefined) {
    out.km_atual = null;
  } else if (typeof out.km_atual === 'string') {
    const n = Number(out.km_atual.replace(',', '.'));
    out.km_atual = Number.isNaN(n) ? null : n;
  }

  // If vehicle is not a heavy type, ensure placa_carreta is null
  const heavy = ['CARRETA', 'BITREM', 'RODOTREM'];
  if (!heavy.includes(out.tipo_veiculo)) {
    out.placa_carreta = null;
  }

  // proprietario_tipo: ensure present (frontend must set default if UI doesn't)
  if (!out.proprietario_tipo) out.proprietario_tipo = 'PROPRIO';

  return out;
}
