import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { Command } from 'commander';
import { convertToMp3 } from './converter.js';
import { analyze } from './analyzer.js';
import { process as processCall } from './process.js';
import { createNotebook, loginProfile } from './notebooklm.js';
import { DEFAULT_ANALYSIS_PROMPT } from './default-prompt.js';

function resolvePrompt(opts: { promptFile?: string; prompt?: string }): string {
  if (opts.promptFile) return readFileSync(opts.promptFile, 'utf-8');
  return opts.prompt || DEFAULT_ANALYSIS_PROMPT;
}

const program = new Command();

program
  .name('transcript')
  .description(
    'Ferramenta CLI para converter, transcrever e analisar gravações de chamadas',
  );

program
  .command('convert')
  .description('Converte áudio/vídeo para MP3')
  .argument('<input>', 'Arquivo de entrada (MP4, WAV, M4A, WebM, etc.)')
  .option(
    '-o, --output <file>',
    'Arquivo de saída (padrão: mesmo nome com .mp3)',
  )
  .option('-b, --bitrate <rate>', 'Bitrate do MP3', '192k')
  .action(async (input, opts) => {
    await convertToMp3(input, opts.output, opts.bitrate);
  });

program
  .command('transcribe')
  .description('Transcreve um arquivo de áudio')
  .argument('<input>', 'Arquivo de áudio (MP3, WAV, M4A, etc.)')
  .option('-t, --transcription-model <model>', 'Modelo de transcrição')
  .option('-o, --output <dir>', 'Diretório de saída')
  .option('-n, --notebook <profile>', 'Criar notebook no NotebookLM (perfil)')
  .action(async (input, opts) => {
    await processCall({
      inputFile: input,
      transcriptionModel: opts.transcriptionModel,
      outputDir: opts.output,
      notebookProfile: opts.notebook,
    });
  });

program
  .command('analyze')
  .description('Analisa uma transcrição existente')
  .argument('<input>', 'Arquivo .txt com a transcrição')
  .option('-p, --prompt <text>', 'Prompt de análise (usa padrão se omitido)')
  .option('-f, --prompt-file <path>', 'Arquivo com o prompt de análise')
  .option('-a, --analysis-model <model>', 'Modelo de análise')
  .action(async (input, opts) => {
    const transcriptionText = readFileSync(input, 'utf-8');
    const prompt = resolvePrompt(opts);
    const result = await analyze(transcriptionText, prompt, opts.analysisModel);
    console.log(result.analysis);
  });

program
  .command('convert-transcribe')
  .description('Converte para MP3 e transcreve')
  .argument('<input>', 'Arquivo de áudio/vídeo')
  .option('-t, --transcription-model <model>', 'Modelo de transcrição')
  .option('-b, --bitrate <rate>', 'Bitrate do MP3', '192k')
  .option('-o, --output <dir>', 'Diretório de saída')
  .option('-n, --notebook <profile>', 'Criar notebook no NotebookLM (perfil)')
  .action(async (input, opts) => {
    await processCall({
      inputFile: input,
      transcriptionModel: opts.transcriptionModel,
      outputDir: opts.output,
      notebookProfile: opts.notebook,
    });
  });

program
  .command('transcribe-analyze')
  .description('Transcreve e analisa um arquivo de áudio')
  .argument('<input>', 'Arquivo de áudio (MP3, WAV, M4A, etc.)')
  .option('-p, --prompt <text>', 'Prompt de análise (usa padrão se omitido)')
  .option('-f, --prompt-file <path>', 'Arquivo com o prompt de análise')
  .option('-t, --transcription-model <model>', 'Modelo de transcrição')
  .option('-a, --analysis-model <model>', 'Modelo de análise')
  .option('-o, --output <dir>', 'Diretório de saída')
  .option('-n, --notebook <profile>', 'Criar notebook no NotebookLM (perfil)')
  .action(async (input, opts) => {
    const prompt = resolvePrompt(opts);
    await processCall({
      inputFile: input,
      analysisPrompt: prompt,
      transcriptionModel: opts.transcriptionModel,
      analysisModel: opts.analysisModel,
      outputDir: opts.output,
      notebookProfile: opts.notebook,
    });
  });

program
  .command('full')
  .description('Pipeline completo: converte, transcreve e analisa')
  .argument('<input>', 'Arquivo de áudio/vídeo')
  .option('-p, --prompt <text>', 'Prompt de análise (usa padrão se omitido)')
  .option('-f, --prompt-file <path>', 'Arquivo com o prompt de análise')
  .option('-t, --transcription-model <model>', 'Modelo de transcrição')
  .option('-a, --analysis-model <model>', 'Modelo de análise')
  .option('-b, --bitrate <rate>', 'Bitrate do MP3', '192k')
  .option('-o, --output <dir>', 'Diretório de saída')
  .option('-n, --notebook <profile>', 'Criar notebook no NotebookLM (perfil)')
  .action(async (input, opts) => {
    const prompt = resolvePrompt(opts);
    await processCall({
      inputFile: input,
      analysisPrompt: prompt,
      transcriptionModel: opts.transcriptionModel,
      analysisModel: opts.analysisModel,
      outputDir: opts.output,
      notebookProfile: opts.notebook,
    });
  });

program
  .command('notebook')
  .description(
    'Cria notebook no NotebookLM a partir de uma pasta de output existente',
  )
  .argument('<folder>', 'Pasta de output (ex: output/importador)')
  .requiredOption(
    '-n, --notebook <profile>',
    'Perfil do NotebookLM (ex: work, personal)',
  )
  .action(async (folder, opts) => {
    const dir = resolve(folder);
    if (!existsSync(dir)) {
      console.error(`Pasta não encontrada: ${dir}`);
      process.exit(1);
    }

    const files = readdirSync(dir)
      .filter((f) => /\.(mp3|md|txt|pdf)$/i.test(f) && f !== 'costs.md')
      .map((f) => resolve(dir, f));

    if (files.length === 0) {
      console.error('Nenhum arquivo compatível encontrado na pasta');
      process.exit(1);
    }

    const name = basename(dir);
    console.log(`Fontes encontradas: ${files.length}`);
    files.forEach((f) => console.log(`  - ${basename(f)}`));

    try {
      await createNotebook(opts.notebook, name, files);
    } catch (err) {
      console.error(`\nErro ao criar notebook: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('login')
  .description(
    'Autentica no NotebookLM via navegador e salva a sessão do perfil',
  )
  .argument('<profile>', 'Nome do perfil (ex: work, personal)')
  .action(async (profile) => {
    try {
      await loginProfile(profile);
    } catch (err) {
      console.error(`\nErro no login: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
