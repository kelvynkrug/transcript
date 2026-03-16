import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
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

export function formatEntryCostMarkdown(
  entry: CostEntry,
  usdBrl: number,
): string {
  const lines: string[] = [];

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

  let accumulatedUsd = entry.total_cost_usd;
  let count = 1;

  if (existsSync(globalCostsFile)) {
    const content = readFileSync(globalCostsFile, 'utf-8');
    const match = content.match(/\*\*Acumulado:\*\*\s+\$([\d.]+)/);
    if (match) {
      accumulatedUsd += parseFloat(match[1]);
    }
    const countMatch = content.match(/\((\d+) processamentos?\)/);
    if (countMatch) {
      count += parseInt(countMatch[1]);
    }
  }

  const newEntry = [
    `### ${fileName}`,
    '',
    `> **Data:** ${dateStr}`,
    '',
    formatEntryCostMarkdown(entry, usdBrl),
    '',
    '---',
    '',
  ].join('\n');

  if (!existsSync(globalCostsFile)) {
    const header = `# Custos Acumulados\n\n---\n\n`;
    writeFileSync(globalCostsFile, header + newEntry, 'utf-8');
  } else {
    appendFileSync(globalCostsFile, newEntry, 'utf-8');
  }

  const content = readFileSync(globalCostsFile, 'utf-8');
  const footerRegex = /\n\*\*Acumulado:\*\*.*$/;
  const footer = `\n**Acumulado:** ${formatDual(accumulatedUsd, usdBrl)} (${count} processamentos)`;

  if (footerRegex.test(content)) {
    writeFileSync(
      globalCostsFile,
      content.replace(footerRegex, footer),
      'utf-8',
    );
  } else {
    appendFileSync(globalCostsFile, footer, 'utf-8');
  }
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
