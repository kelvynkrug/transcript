import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';

export interface CostEntry {
  timestamp: string;
  file: string;
  transcription: {
    model: string;
    duration_seconds: number;
    cost_usd: number;
  } | null;
  analysis: {
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    cost_usd: number;
  } | null;
  total_cost_usd: number;
}

function formatUsd(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}

function formatBrl(brl: number): string {
  if (brl < 0.01) return `R$${brl.toFixed(6)}`;
  return `R$${brl.toFixed(4)}`;
}

function formatDual(usd: number, rate: number): string {
  return `${formatUsd(usd)} (${formatBrl(usd * rate)})`;
}

interface AcumuladoState {
  usd: number;
  count: number;
  transcription: Record<string, { min: number; cost_usd: number }>;
  analysis: Record<string, { in: number; out: number; cost_usd: number }>;
}

function parseLastAcumulado(content: string): AcumuladoState | null {
  const blockMatch = content.match(/\n\*\*Acumulado:\*\*[\s\S]*$/);
  if (!blockMatch) return null;

  const block = blockMatch[0];
  const firstLine = block.split('\n')[0];
  const usdMatch = firstLine.match(/\$([\d.]+)/);
  const countMatch = firstLine.match(/\((\d+) processamentos?\)/);
  if (!usdMatch) return null;

  const state: AcumuladoState = {
    usd: parseFloat(usdMatch[1]),
    count: countMatch ? parseInt(countMatch[1], 10) : 0,
    transcription: {},
    analysis: {},
  };

  const tableRows = block.matchAll(/\|\s*Transcrição\s*\|\s*[^|]*\|\s*([^|]+)\|\s*([^|]+)\|\s*\$([\d.]+)\s*\|/g);
  for (const m of tableRows) {
    const model = m[1].trim();
    const detail = m[2].trim();
    const minMatch = detail.match(/([\d.]+)\s*min/);
    if (minMatch) {
      state.transcription[model] = {
        min: parseFloat(minMatch[1]),
        cost_usd: parseFloat(m[3]),
      };
    }
  }
  const analysisRows = block.matchAll(/\|\s*Análise\s*\|\s*[^|]*\|\s*([^|]+)\|\s*(\d+)\s+in\s*\/\s*(\d+)\s+out\s*\|\s*\$([\d.]+)\s*\|/g);
  for (const m of analysisRows) {
    const model = m[1].trim();
    state.analysis[model] = {
      in: parseInt(m[2], 10),
      out: parseInt(m[3], 10),
      cost_usd: parseFloat(m[4]),
    };
  }

  if (Object.keys(state.transcription).length === 0 && Object.keys(state.analysis).length === 0) {
    const modelLines = block.matchAll(/-\s+\*\*([^*]+):\*\*\s+(.+)/g);
    for (const m of modelLines) {
      const model = m[1].trim();
      const detail = m[2].trim();
      const minMatch = detail.match(/^([\d.]+)\s*min$/);
      const tokensMatch = detail.match(/^([\d.]+)\s+in\s*\/\s*([\d.]+)\s+out$/);
      if (minMatch) {
        state.transcription[model] = { min: parseFloat(minMatch[1]), cost_usd: 0 };
      } else if (tokensMatch) {
        state.analysis[model] = {
          in: parseInt(tokensMatch[1], 10),
          out: parseInt(tokensMatch[2], 10),
          cost_usd: 0,
        };
      }
    }
  }

  return state;
}

function formatAcumuladoBlock(
  state: AcumuladoState,
  usdBrl: number,
): string {
  const lines: string[] = [
    '',
    '---',
    '',
    '### Acumulado',
    '',
    `**Acumulado:** ${formatDual(state.usd, usdBrl)} (${state.count} processamentos)`,
    '',
    '| Etapa | Data | Modelo | Detalhe | USD | BRL |',
    '|-------|------|--------|---------|-----|-----|',
  ];
  for (const [model, v] of Object.entries(state.transcription).sort()) {
    const usdCell = v.cost_usd > 0 ? formatUsd(v.cost_usd) : '—';
    const brlCell = v.cost_usd > 0 ? formatBrl(v.cost_usd * usdBrl) : '—';
    lines.push(
      `| Transcrição | — | ${model} | ${v.min.toFixed(1)} min | ${usdCell} | ${brlCell} |`,
    );
  }
  for (const [model, t] of Object.entries(state.analysis).sort()) {
    const usdCell = t.cost_usd > 0 ? formatUsd(t.cost_usd) : '—';
    const brlCell = t.cost_usd > 0 ? formatBrl(t.cost_usd * usdBrl) : '—';
    lines.push(
      `| Análise | — | ${model} | ${t.in} in / ${t.out} out | ${usdCell} | ${brlCell} |`,
    );
  }
  return lines.join('\n') + '\n';
}

export function formatEntryCostMarkdown(
  entry: CostEntry,
  usdBrl: number,
  dateStr?: string,
): string {
  const lines: string[] = [];

  if (dateStr) {
    lines.push(`> **Data:** ${dateStr}`);
    lines.push('');
  }
  lines.push(`> **Cotação USD/BRL:** R$${usdBrl.toFixed(4)}`);
  lines.push('');
  lines.push('| Etapa | Modelo | Detalhe | USD | BRL |');
  lines.push('|-------|--------|---------|-----|-----|');

  if (entry.transcription) {
    const t = entry.transcription;
    const mins = (t.duration_seconds / 60).toFixed(1);
    lines.push(
      `| Transcrição | ${t.model} | ${mins} min | ${formatUsd(t.cost_usd)} | ${formatBrl(t.cost_usd * usdBrl)} |`,
    );
  }

  if (entry.analysis) {
    const a = entry.analysis;
    lines.push(
      `| Análise | ${a.model} | ${a.prompt_tokens} in / ${a.completion_tokens} out | ${formatUsd(a.cost_usd)} | ${formatBrl(a.cost_usd * usdBrl)} |`,
    );
  }

  lines.push('');
  lines.push(`**Total:** ${formatDual(entry.total_cost_usd, usdBrl)}`);

  return lines.join('\n');
}

export function appendToGlobalCosts(
  outputRootDir: string,
  entry: CostEntry,
  fileName: string,
  usdBrl: number,
): void {
  mkdirSync(outputRootDir, { recursive: true });
  const globalCostsFile = join(outputRootDir, 'costs.md');

  const dateStr = new Date(entry.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });

  let state: AcumuladoState = {
    usd: 0,
    count: 0,
    transcription: {},
    analysis: {},
  };

  if (existsSync(globalCostsFile)) {
    const content = readFileSync(globalCostsFile, 'utf-8');
    const parsed = parseLastAcumulado(content);
    if (parsed) state = parsed;
  }

  state.usd += entry.total_cost_usd;
  state.count += 1;

  if (entry.transcription) {
    const t = entry.transcription;
    const min = t.duration_seconds / 60;
    const prev = state.transcription[t.model];
    state.transcription[t.model] = {
      min: (prev?.min ?? 0) + min,
      cost_usd: (prev?.cost_usd ?? 0) + t.cost_usd,
    };
  }
  if (entry.analysis) {
    const a = entry.analysis;
    const prev = state.analysis[a.model];
    state.analysis[a.model] = {
      in: (prev?.in ?? 0) + a.prompt_tokens,
      out: (prev?.out ?? 0) + a.completion_tokens,
      cost_usd: (prev?.cost_usd ?? 0) + a.cost_usd,
    };
  }

  const newEntry = [
    `### ${fileName}`,
    '',
    formatEntryCostMarkdown(entry, usdBrl, dateStr),
    '',
  ].join('\n');

  let content: string;

  if (!existsSync(globalCostsFile)) {
    content = `# Custos Acumulados\n\n---\n\n`;
  } else {
    content = readFileSync(globalCostsFile, 'utf-8');
    content = content.replace(/\n---\n\n(### Acumulado\n\n)?\*\*Acumulado:\*\*[\s\S]*$/, '');
    content = content.replace(/\n---\n\n\*\*Acumulado:\*\*[^\n]+\n/g, '');
    if (!content.endsWith('\n')) content += '\n';
    content += '\n';
  }

  content += newEntry;
  content += formatAcumuladoBlock(state, usdBrl);

  writeFileSync(globalCostsFile, content, 'utf-8');
}

export function printCostSummary(entry: CostEntry, usdBrl: number): void {
  console.log('\n--- Custos ---');
  console.log(`Cotação USD/BRL: R$${usdBrl.toFixed(4)}`);

  if (entry.transcription) {
    const t = entry.transcription;
    const mins = (t.duration_seconds / 60).toFixed(1);
    console.log(
      `Transcrição: ${t.model} | ${mins}min | ${formatDual(t.cost_usd, usdBrl)}`,
    );
  }

  if (entry.analysis) {
    const a = entry.analysis;
    const tokens = a.prompt_tokens + a.completion_tokens;
    console.log(
      `Análise:     ${a.model} | ${tokens} tokens | ${formatDual(a.cost_usd, usdBrl)}`,
    );
  }

  console.log(`Total:       ${formatDual(entry.total_cost_usd, usdBrl)}`);
}
