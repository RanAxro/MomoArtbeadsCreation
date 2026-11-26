import { createProject } from '$domain/project';
import { decodeShareCode } from '$modules/board/board-codec';
import { workspace } from '$modules/workspace/workspace.svelte';

export async function importShareCodeToWorkspace(value: string): Promise<void> {
  const data = await decodeShareCode(value);
  await workspace.initialize();

  const project = createProject({
    name: data.name,
    width: data.width,
    height: data.height,
    palette: data.palette
  });
  project.cells = data.cells;
  await workspace.create(project);
}

export async function importShareCodeFromClipboard(): Promise<void> {
  if (!navigator.clipboard?.readText) {
    throw new Error('Clipboard reading is unavailable.');
  }

  const shareCode = await navigator.clipboard.readText();
  await importShareCodeToWorkspace(shareCode);
}
