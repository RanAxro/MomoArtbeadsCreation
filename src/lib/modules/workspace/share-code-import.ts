import { createProject } from '$domain/project';
import { clonePalette } from '$domain/palette';
import type { BoardTransferData } from '$modules/board/board-codec';
import { decodeShareCode } from '$modules/board/board-codec';
import type { BeadProject } from '$model/project.model';
import { workspace } from '$modules/workspace/workspace.svelte';

export async function createProjectFromShareCodeData(
  data: BoardTransferData
): Promise<BeadProject> {
  await workspace.initialize();

  const project = createProject({
    name: data.name,
    width: data.width,
    height: data.height,
    palette: clonePalette(data.palette)
  });
  project.cells = [...data.cells];
  await workspace.create(project);
  return project;
}

export async function importShareCodeToWorkspace(
  value: string
): Promise<BeadProject> {
  return createProjectFromShareCodeData(await decodeShareCode(value));
}
