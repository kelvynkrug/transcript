# Transcript

Ferramenta CLI para converter, transcrever e analisar gravações de chamadas telefônicas.

Recebe um arquivo de áudio/vídeo, transcreve usando **Groq Whisper** e opcionalmente analisa o conteúdo com **OpenAI GPT** a partir de um prompt customizável. Exibe custos em USD e BRL (cotação em tempo real).

## Setup

```bash
npm install
```

Crie um arquivo `.env` na raiz:

```env
GROQ_API_KEY=sua_chave_groq
OPENAI_API_KEY=sua_chave_openai
```

Requer **FFmpeg** instalado no sistema (`brew install ffmpeg`).

## Uso

### Converter áudio/vídeo para MP3

```bash
yarn convert gravacao.mp4
```

### Transcrever

```bash
yarn transcribe gravacao.mp3
```

### Analisar uma transcrição existente

```bash
yarn analyze output/importador/transcription.md -p "Resuma os pontos principais"
```

### Converter + transcrever

```bash
yarn convert:transcribe gravacao.mp4
```

### Transcrever + analisar

```bash
yarn transcribe:analyze gravacao.mp3 -p "Identifique os problemas técnicos"
```

### Pipeline completo (converter + transcrever + analisar)

```bash
yarn full gravacao.mp4 -p "Pontue os to-dos dessa reunião"
```

### Análise com prompt de arquivo

```bash
yarn full gravacao.mp4 -f prompts/regras_negocio.txt
```

## Opções

| Flag                        | Descrição                                          |
| --------------------------- | -------------------------------------------------- |
| `-p, --prompt`              | Prompt de análise inline                           |
| `-f, --prompt-file`         | Arquivo com o prompt de análise                    |
| `-t, --transcription-model` | Modelo de transcrição (padrão: `whisper-large-v3`) |
| `-a, --analysis-model`      | Modelo de análise (padrão: `gpt-5.4`)              |
| `-o, --output`              | Diretório de saída (padrão: `output/`)             |
| `-b, --bitrate`             | Bitrate do MP3 (padrão: `192k`)                    |

## Saída

Cada execução cria uma pasta em `output/<nome_do_arquivo>/` com:

- `transcription.md` — texto da transcrição
- `analysis.md` — resultado da análise (quando há prompt)
- `costs.md` — custo desse processamento em USD e BRL

O arquivo `output/costs.md` acumula o histórico de custos de todos os processamentos.

### Exemplo de costs.md

```md
| Etapa       | Modelo           | Detalhe            | USD     | BRL      |
| ----------- | ---------------- | ------------------ | ------- | -------- |
| Transcrição | whisper-large-v3 | 46.4 min           | $0.0858 | R$0.4487 |
| Análise     | gpt-5.4          | 8969 in / 1600 out | $0.0464 | R$0.2427 |

**Total:** $0.1323 (R$0.6914)
```

## Formatos suportados

Qualquer formato de áudio/vídeo suportado pelo FFmpeg (MP4, MP3, WAV, M4A, WebM, etc.). Arquivos não-MP3 são convertidos automaticamente.

Arquivos maiores que 25MB são divididos automaticamente em partes de 10 minutos para respeitar o limite da API do Groq.
