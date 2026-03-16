import { readFileSync } from 'fs';
import { Command } from 'commander';
import { convertToMp3 } from './converter.js';
import { analyze } from './analyzer.js';
import { process as processCall } from './process.js';
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
  .action(async (input, opts) => {
    await processCall({
      inputFile: input,
      transcriptionModel: opts.transcriptionModel,
      outputDir: opts.output,
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
  .action(async (input, opts) => {
    await processCall({
      inputFile: input,
      transcriptionModel: opts.transcriptionModel,
      outputDir: opts.output,
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
  .action(async (input, opts) => {
    const prompt = resolvePrompt(opts);
    await processCall({
      inputFile: input,
      analysisPrompt: prompt,
      transcriptionModel: opts.transcriptionModel,
      analysisModel: opts.analysisModel,
      outputDir: opts.output,
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
  .action(async (input, opts) => {
    const prompt = resolvePrompt(opts);
    await processCall({
      inputFile: input,
      analysisPrompt: prompt,
      transcriptionModel: opts.transcriptionModel,
      analysisModel: opts.analysisModel,
      outputDir: opts.output,
    });
  });

program.parse();
