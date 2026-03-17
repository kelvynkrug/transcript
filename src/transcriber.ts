import { createReadStream, statSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { config } from './config.js';

const groq = new Groq({ apiKey: config.groqApiKey });
const openai = new OpenAI({ apiKey: config.openaiApiKey });

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const OPENAI_MODELS = ['whisper-1'];

function isOpenAIModel(model: string): boolean {
  return OPENAI_MODELS.includes(model);
}

function getClient(model: string) {
  return isOpenAIModel(model) ? openai : groq;
}

export interface TranscriptionResult {
  text: string;
  duration: number | null;
  language: string | null;
  segments: Record<string, unknown>[];
  model: string;
}

export async function transcribe(
  audioPath: string,
  model?: string,
): Promise<TranscriptionResult> {
  const aiModel = model || config.transcriptionModel;
  const fileSize = statSync(audioPath).size;

  if (fileSize > MAX_FILE_SIZE) {
    console.log(
      `Arquivo grande (${(fileSize / 1024 / 1024).toFixed(1)}MB). Dividindo em partes...`,
    );
    return transcribeChunks(audioPath, aiModel);
  }

  const client = getClient(aiModel);
  const response = await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: aiModel,
    response_format: 'verbose_json',
  });

  const raw = response as any;
  const segments = (raw.segments ?? []) as Record<string, unknown>[];
  const duration =
    raw.duration ??
    (segments.length > 0
      ? ((segments[segments.length - 1] as any).end ?? null)
      : null);

  return {
    text: response.text,
    duration,
    language: raw.language ?? null,
    segments,
    model: aiModel,
  };
}

async function transcribeChunks(
  audioPath: string,
  model: string,
): Promise<TranscriptionResult> {
  const chunkDir = join(dirname(audioPath), '.chunks');
  mkdirSync(chunkDir, { recursive: true });

  const chunkPattern = join(chunkDir, 'chunk_%03d.mp3');

  execSync(
    `ffmpeg -i "${audioPath}" -f segment -segment_time 600 -vn -acodec libmp3lame -ab 128k -y "${chunkPattern}"`,
    { stdio: 'pipe' },
  );

  const chunks = readdirSync(chunkDir)
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.mp3'))
    .sort()
    .map((f) => join(chunkDir, f));

  const client = getClient(model);
  const allText: string[] = [];
  const allSegments: Record<string, unknown>[] = [];
  let language: string | null = null;
  let totalDuration = 0;

  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Transcrevendo parte ${i + 1}/${chunks.length}...`);

    const response = await client.audio.transcriptions.create({
      file: createReadStream(chunks[i]),
      model,
      response_format: 'verbose_json',
    });

    const raw = response as any;
    const segments = (raw.segments ?? []) as Record<string, unknown>[];

    allText.push(response.text);
    allSegments.push(...segments);
    language = raw.language ?? language;

    const chunkDuration =
      raw.duration ??
      (segments.length > 0
        ? ((segments[segments.length - 1] as any).end ?? 0)
        : 0);
    totalDuration += chunkDuration;
  }

  for (const chunk of chunks) unlinkSync(chunk);
  rmSync(chunkDir, { recursive: true });

  return {
    text: allText.join(' '),
    duration: totalDuration || null,
    language,
    segments: allSegments,
    model,
  };
}
