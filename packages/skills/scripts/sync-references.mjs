import { mkdir, readdir, rm, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const designDir = path.join(repoRoot, 'design');
const referencesDir = path.join(packageRoot, 'references');

const isEnglishDesignMarkdown = (fileName) =>
  fileName.endsWith('.md') && !fileName.endsWith('_CN.md');

async function main() {
  const designStat = await stat(designDir).catch(() => null);

  if (!designStat || !designStat.isDirectory()) {
    throw new Error(`Design directory not found: ${designDir}`);
  }

  await rm(referencesDir, { recursive: true, force: true });
  await mkdir(referencesDir, { recursive: true });

  const fileNames = await readdir(designDir);
  const copied = [];

  for (const fileName of fileNames) {
    if (!isEnglishDesignMarkdown(fileName)) {
      continue;
    }

    const sourcePath = path.join(designDir, fileName);
    const sourceStat = await stat(sourcePath);

    if (!sourceStat.isFile()) {
      continue;
    }

    const targetPath = path.join(referencesDir, fileName);
    await copyFile(sourcePath, targetPath);
    copied.push(fileName);
  }

  copied.sort((a, b) => a.localeCompare(b));

  console.log(`[sync:references] copied ${copied.length} file(s) to references/`);
  for (const fileName of copied) {
    console.log(`[sync:references] - ${fileName}`);
  }
}

main().catch((error) => {
  console.error('[sync:references] failed:', error.message);
  process.exitCode = 1;
});
