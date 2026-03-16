import OpenAI from 'openai';
import { config } from './config.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface AnalysisResult {
  analysis: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function analyze(
  transcriptionText: string,
  prompt: string,
  model?: string,
): Promise<AnalysisResult> {
  const aiModel = model || config.analysisModel;

  const response = await openai.chat.completions.create({
    model: aiModel,
    messages: [
      {
        role: 'system',
        content:
          'Você é um analista especializado em calls. ' +
          'Analise a transcrição fornecida conforme as instruções do usuário. ' +
          'Seja objetivo e estruturado na resposta.',
      },
      {
        role: 'user',
        content: `## Instruções de análise\n${prompt}\n\n## Transcrição\n${transcriptionText}`,
      },
    ],
  });

  const usage = response.usage!;

  return {
    analysis: response.choices[0].message.content!,
    model: aiModel,
    usage: {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    },
  };
}
