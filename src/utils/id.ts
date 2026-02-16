import fs from 'fs';
import path from 'path';

export const generateId = (prefix?: string): string => {
  // Persist counters per-prefix in .data/id_counters.json
  try {
    const dataDir = path.join(process.cwd(), '.data');
    const countersFile = path.join(dataDir, 'id_counters.json');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let counters: Record<string, number> = {};
    if (fs.existsSync(countersFile)) {
      const raw = fs.readFileSync(countersFile, 'utf8');
      counters = raw ? JSON.parse(raw) : {};
    }

    // Special-case user short ids (u1, u2, ...)
    if (prefix === 'USR') {
      const next = (counters['USR'] || 0) + 1;
      counters['USR'] = next;
      fs.writeFileSync(countersFile, JSON.stringify(counters), 'utf8');
      return `u${next}`;
    }

    // Special-case frota: FROTA-001, FROTA-002
    if (prefix === 'FROTA') {
      const next = (counters['FROTA'] || 0) + 1;
      counters['FROTA'] = next;
      fs.writeFileSync(countersFile, JSON.stringify(counters), 'utf8');
      const num = String(next).padStart(3, '0');
      return `FROTA-${num}`;
    }

    // General incrementing id per-prefix if requested
    if (prefix) {
      const key = String(prefix).toUpperCase();
      const next = (counters[key] || 0) + 1;
      counters[key] = next;
      fs.writeFileSync(countersFile, JSON.stringify(counters), 'utf8');
      const num = String(next).padStart(6, '0');
      return `${key}-${num}`;
    }
  } catch (err) {
    // ignore and fallback to timestamped id
  }

  // Fallback behavior: timestamp + random suffix
  const rand = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  const base = `${Date.now()}${rand}`;
  return prefix ? `${prefix}-${base}` : base;
};
