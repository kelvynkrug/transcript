import ffmpeg from 'fluent-ffmpeg';
import { existsSync } from 'fs';
import { extname, basename, dirname, join, resolve } from 'path';

export async function convertToMp3(
  inputFile: string,
  outputFile?: string,
  bitrate = '192k',
): Promise<string> {
  const input = resolve(inputFile);

  if (!existsSync(input)) {
    throw new Error(`Arquivo não encontrado: ${input}`);
  }

  if (extname(input).toLowerCase() === '.mp3') {
    return input;
  }

  const output = outputFile
    ? resolve(outputFile)
    : join(dirname(input), `${basename(input, extname(input))}.mp3`);

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate(bitrate)
      .output(output)
      .on('end', () => {
        console.log(`Convertido: ${input} -> ${output}`);
        resolve(output);
      })
      .on('error', (err) =>
        reject(new Error(`Erro na conversão: ${err.message}`)),
      )
      .run();
  });
}
