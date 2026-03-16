export interface ModelPricing {
  input: number;
  output: number;
  unit: 'token' | 'second';
}

const SECONDS_PER_HOUR = 3600;
const TOKENS_PER_MILLION = 1_000_000;

// Fontes: https://groq.com/pricing/ | https://openai.com/api/pricing/

// Groq — transcrição (USD por hora de áudio)
const transcriptionModels: Record<string, number> = {
  'whisper-large-v3': 0.111,
  'whisper-large-v3-turbo': 0.04,
};

// OpenAI — análise (USD por 1M tokens: [input, output])
const analysisModels: Record<string, [input: number, output: number]> = {
  'gpt-5.4': [2.5, 15.0],
  'gpt-5-mini': [0.25, 2.0],
  'gpt-4.1': [3.0, 12.0],
  'gpt-4.1-mini': [0.8, 3.2],
  'gpt-4.1-nano': [0.2, 0.8],
  'o4-mini': [4.0, 16.0],
};

const pricing: Record<string, ModelPricing> = {};

for (const [model, pricePerHour] of Object.entries(transcriptionModels)) {
  pricing[model] = {
    input: pricePerHour / SECONDS_PER_HOUR,
    output: 0,
    unit: 'second',
  };
}

for (const [model, [inputPerMillion, outputPerMillion]] of Object.entries(
  analysisModels,
)) {
  pricing[model] = {
    input: inputPerMillion / TOKENS_PER_MILLION,
    output: outputPerMillion / TOKENS_PER_MILLION,
    unit: 'token',
  };
}

export function getModelPricing(model: string): ModelPricing | null {
  return pricing[model] ?? null;
}

export function calculateTranscriptionCost(
  model: string,
  durationSeconds: number,
): number {
  const p = getModelPricing(model);
  if (!p || p.unit !== 'second') return 0;
  return durationSeconds * p.input;
}

export function calculateAnalysisCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = getModelPricing(model);
  if (!p || p.unit !== 'token') return 0;
  return promptTokens * p.input + completionTokens * p.output;
}
