import { copyFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, extname, resolve } from 'path';
import { convertToMp3 } from './converter.js';
import { transcribe, type TranscriptionResult } from './transcriber.js';
import { analyze, type AnalysisResult } from './analyzer.js';
import { config } from './config.js';
import {
  calculateTranscriptionCost,
  calculateAnalysisCost,
} from './pricing.js';
import { getUsdToBrl } from './exchange.js';
import {
  printCostSummary,
  formatEntryCostMarkdown,
  appendToGlobalCosts,
  type CostEntry,
} from './cost-tracker.js';
import { createNotebook } from './notebooklm.js';

export interface ProcessResult {
  input_file: string;
  transcription: TranscriptionResult;
  analysis: AnalysisResult | null;
}

export async function process(options: {
  inputFile: string;
  analysisPrompt?: string;
  transcriptionModel?: string;
  analysisModel?: string;
  outputDir?: string;
  notebookProfile?: string;
}): Promise<ProcessResult> {
  const { analysisPrompt, transcriptionModel, analysisModel, notebookProfile } =
    options;
  const inputFile = resolve(options.inputFile);
  const fileName = basename(inputFile, extname(inputFile));
  const cwd = globalThis.process.cwd();
  const outputRootDir = options.outputDir
    ? resolve(options.outputDir)
    : join(cwd, 'output');
  const outputDir = join(outputRootDir, fileName);

  mkdirSync(outputDir, { recursive: true });

  const now = new Date();
  const dateStr = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  const header = (title: string) =>
    `# ${title}\n\n> **Arquivo:** ${fileName}  \n> **Data:** ${dateStr}\n\n---\n\n`;

  console.log(`Processando: ${inputFile}`);
  console.log(`Saída: ${outputDir}`);

  const mp3Path = await convertToMp3(inputFile);

  copyFileSync(mp3Path, join(outputDir, basename(mp3Path)));

  const tModel = transcriptionModel || config.transcriptionModel;
  console.log(`Transcrevendo com ${tModel}...`);

  const transcription = await transcribe(mp3Path, transcriptionModel);
  console.log(
    `Transcrição concluída (${transcription.text.length} caracteres)`,
  );

  writeFileSync(
    join(outputDir, 'transcription.md'),
    header('Transcrição') + transcription.text,
    'utf-8',
  );

  const result: ProcessResult = {
    input_file: inputFile,
    transcription,
    analysis: null,
  };

  if (analysisPrompt) {
    const aModel = analysisModel || config.analysisModel;
    console.log(`Analisando com ${aModel}...`);
    result.analysis = await analyze(
      transcription.text,
      analysisPrompt,
      analysisModel,
    );
    console.log('Análise concluída');

    writeFileSync(
      join(outputDir, 'analysis.md'),
      header('Análise') + result.analysis.analysis,
      'utf-8',
    );
  }

  const transcriptionCost = calculateTranscriptionCost(
    transcription.model,
    transcription.duration ?? 0,
  );

  const analysisCost = result.analysis
    ? calculateAnalysisCost(
        result.analysis.model,
        result.analysis.usage.prompt_tokens,
        result.analysis.usage.completion_tokens,
      )
    : 0;

  const costEntry: CostEntry = {
    timestamp: now.toISOString(),
    file: inputFile,
    transcription: {
      model: transcription.model,
      duration_seconds: transcription.duration ?? 0,
      cost_usd: transcriptionCost,
    },
    analysis: result.analysis
      ? {
          model: result.analysis.model,
          prompt_tokens: result.analysis.usage.prompt_tokens,
          completion_tokens: result.analysis.usage.completion_tokens,
          cost_usd: analysisCost,
        }
      : null,
    total_cost_usd: transcriptionCost + analysisCost,
  };

  const usdBrl = await getUsdToBrl();

  const dateStr = new Date(costEntry.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  writeFileSync(
    join(outputDir, 'costs.md'),
    header('Custos') + formatEntryCostMarkdown(costEntry, usdBrl, dateStr),
    'utf-8',
  );

  appendToGlobalCosts(outputRootDir, costEntry, fileName, usdBrl);

  printCostSummary(costEntry, usdBrl);
  console.log(`\nResultados salvos em: ${outputDir}`);

  if (notebookProfile) {
    const sources = [
      join(outputDir, basename(mp3Path)),
      join(outputDir, 'transcription.md'),
    ];
    if (result.analysis) {
      sources.push(join(outputDir, 'analysis.md'));
    }
    try {
      await createNotebook(notebookProfile, fileName, sources);
    } catch (err) {
      console.error(`\nErro ao criar notebook: ${(err as Error).message}`);
    }
  }

  return result;
}
