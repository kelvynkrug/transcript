# Transcript

Ferramenta CLI para converter, transcrever e analisar gravações de chamadas telefônicas.

Recebe um arquivo de áudio/vídeo, transcreve usando **Groq Whisper** e analisa o conteúdo com **OpenAI GPT** (prompt padrão ou customizável). Exibe custos em USD e BRL (cotação em tempo real). Opcionalmente cria um notebook no **NotebookLM** com as fontes e artefatos do estúdio.

## Setup

```bash
npm install
cp .env.example .env
```

Preencha o `.env` com suas chaves:

```env
GROQ_API_KEY=sua_chave_groq
OPENAI_API_KEY=sua_chave_openai
```

Requer **FFmpeg** instalado no sistema (`brew install ffmpeg`).

## Uso

### Pipeline completo (converter + transcrever + analisar)

```bash
yarn full gravacao.mp4
```

Sem `-p`, usa o prompt padrão que gera: resumo geral, participantes, pontos discutidos, decisões tomadas, ações/próximos passos e pendências.

### Com prompt customizado

```bash
yarn full gravacao.mp4 -p "Pontue os to-dos dessa reunião"
```

### Com prompt de arquivo

```bash
yarn full gravacao.mp4 -f prompts/regras_negocio.txt
```

### Outros subcomandos

```bash
yarn convert gravacao.mp4                # Converte áudio/vídeo → MP3
yarn transcribe gravacao.mp3             # Transcreve áudio
yarn analyze transcricao.md              # Analisa transcrição existente
yarn convert:transcribe gravacao.mp4     # Converte + transcreve
yarn transcribe:analyze gravacao.mp3     # Transcreve + analisa
```

## Integração com NotebookLM

Cria automaticamente um notebook no Google NotebookLM com as fontes (áudio, transcrição, análise) e solicita artefatos do estúdio: resumo em áudio, resumo em vídeo e apresentação de slides.

### Autenticação

Suporta múltiplos perfis (ex: conta corporativa e pessoal). A autenticação é feita via login interativo — abre o navegador, você faz login na conta Google desejada e a sessão é salva automaticamente.

```bash
# Login por perfil (abre o navegador)
yarn auth work
yarn auth personal
```

As sessões ficam salvas em `.notebooklm/` na raiz do projeto. Quando a sessão expirar, basta rodar `yarn auth <perfil>` novamente.

### Uso

```bash
# Pipeline completo + notebook na conta corporativa
yarn full gravacao.mp4 -n work

# Pipeline completo + notebook na conta pessoal
yarn full gravacao.mp4 -n personal

# Criar notebook a partir de uma pasta de output existente
yarn notebook output/importador -n work

# Sem -n, não cria notebook
yarn full gravacao.mp4
```

## Opções

| Flag                        | Descrição                                          |
| --------------------------- | -------------------------------------------------- |
| `-p, --prompt`              | Prompt de análise (usa padrão se omitido)          |
| `-f, --prompt-file`         | Arquivo com o prompt de análise                    |
| `-t, --transcription-model` | Modelo de transcrição (ver tabela abaixo)          |
| `-a, --analysis-model`      | Modelo de análise (padrão: `gpt-5.4`)              |
| `-o, --output`              | Diretório de saída (padrão: `output/`)             |
| `-b, --bitrate`             | Bitrate do MP3 (padrão: `192k`)                    |
| `-n, --notebook`            | Perfil do NotebookLM (ex: `work`, `personal`)      |

## Modelos de transcrição

O provider é selecionado automaticamente pelo modelo escolhido:

| Modelo                  | Provider | Custo/hora |
| ----------------------- | -------- | ---------- |
| `whisper-large-v3`      | Groq     | $0.111     |
| `whisper-large-v3-turbo`| Groq     | $0.04      |
| `whisper-1`             | OpenAI   | $0.36      |

O padrão é `whisper-large-v3` (Groq). Para usar OpenAI:

```bash
yarn full gravacao.mp4 -t whisper-1
```

Ou defina no `.env`:

```env
TRANSCRIPTION_MODEL=whisper-1
```

## Saída

Cada execução cria uma pasta em `output/<nome_do_arquivo>/` com:

- `<nome>.mp3` — cópia do áudio processado
- `transcription.md` — texto da transcrição
- `analysis.md` — resultado da análise
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

## Variáveis de Ambiente

| Variável              | Obrigatória | Descrição                         |
| --------------------- | ----------- | --------------------------------- |
| `GROQ_API_KEY`        | Sim         | Chave da API Groq                 |
| `OPENAI_API_KEY`      | Sim         | Chave da API OpenAI               |
| `TRANSCRIPTION_MODEL` | Não         | Override do modelo de transcrição |
| `ANALYSIS_MODEL`      | Não         | Override do modelo de análise     |

## Formatos suportados

Qualquer formato de áudio/vídeo suportado pelo FFmpeg (MP4, MP3, WAV, M4A, WebM, etc.). Arquivos não-MP3 são convertidos automaticamente.

Arquivos maiores que 25MB são divididos automaticamente em partes de 10 minutos para respeitar o limite da API do Groq.
