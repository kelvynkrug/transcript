import 'dotenv/config';

export const config = {
  groqApiKey: process.env.GROQ_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  transcriptionModel: process.env.TRANSCRIPTION_MODEL || 'whisper-large-v3',
  analysisModel: process.env.ANALYSIS_MODEL || 'gpt-5.4',
};
