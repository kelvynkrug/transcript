import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { NotebookLMClient } from 'notebooklm-sdk';
import { login } from 'notebooklm-sdk/auth';

const SESSION_DIR = join(process.cwd(), '.notebooklm');
const getSessionFile = (profile: string) =>
  join(SESSION_DIR, `session-${profile}.json`);

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
};

function getMimeType(filePath: string): string {
  return (
    MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function connectProfile(profile: string): Promise<NotebookLMClient> {
  const sessionFile = getSessionFile(profile);
  if (!existsSync(sessionFile)) {
    throw new Error(
      `Sessão não encontrada para o perfil "${profile}". Execute: yarn login ${profile}`,
    );
  }
  return NotebookLMClient.connect({ cookiesFile: sessionFile });
}

export async function loginProfile(profile: string): Promise<void> {
  mkdirSync(SESSION_DIR, { recursive: true });

  console.log(`Abrindo navegador para login do perfil "${profile}"...`);
  console.log('Faça login na conta Google desejada e aguarde.');

  const { storageState } = await login({
    persistFolder: join(SESSION_DIR, `.auth_profile_${profile}`),
  });

  writeFileSync(getSessionFile(profile), JSON.stringify(storageState, null, 2));
  console.log(`Sessão salva para o perfil "${profile}"`);
}

async function requestArtifacts(client: NotebookLMClient, notebookId: string) {
  const lang = { language: 'pt-BR' };
  const requests = [
    {
      name: 'Resumo em áudio',
      create: () => client.artifacts.createAudio(notebookId, lang),
    },
    {
      name: 'Resumo em vídeo',
      create: () => client.artifacts.createVideo(notebookId, lang),
    },
    {
      name: 'Apresentação de slides',
      create: () => client.artifacts.createSlideDeck(notebookId, lang),
    },
    // { name: 'Infográfico', create: () => client.artifacts.createInfographic(notebookId, lang) },
  ];

  console.log('Solicitando artefatos do estúdio...');

  for (const { name, create } of requests) {
    try {
      const status = await create();
      if (status.artifactId) {
        console.log(`  ✓ ${name} solicitado`);
      } else {
        console.log(`  ✗ ${name}: sem ID retornado`);
      }
    } catch (err) {
      console.log(`  ✗ ${name}: ${(err as Error).message}`);
    }
    await sleep(3000);
  }
}

export async function createNotebook(
  profile: string,
  name: string,
  sourceFiles: string[],
): Promise<string> {
  const client = await connectProfile(profile);

  console.log(`Criando notebook "${name}" no perfil "${profile}"...`);
  const { id } = await client.notebooks.create(name);

  const sourceIds: string[] = [];
  for (const file of sourceFiles) {
    console.log(`Adicionando fonte: ${file}`);
    const source = await client.sources.addFile(id, file, getMimeType(file));
    sourceIds.push(source.id);
  }

  console.log(`Notebook criado com ${sourceFiles.length} fonte(s)`);

  console.log('Aguardando fontes serem processadas...');
  await client.sources.waitForSources(id, sourceIds);
  console.log('Fontes prontas');

  await requestArtifacts(client, id);

  return id;
}
