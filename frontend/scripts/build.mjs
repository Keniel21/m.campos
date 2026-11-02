import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'frontend', 'dist');
if (path.resolve(output) !== path.resolve(root, 'frontend/dist')) throw new Error('Destino de build inválido.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const asset of ['index.html', 'style.css', 'app.js', 'service-worker.js', 'manifest.json', 'firebase-applet-config.json', 'src']) {
  await cp(path.join(root, asset), path.join(output, asset), { recursive: true });
}
console.log('Frontend original preparado sem alterar HTML, CSS ou módulos.');
