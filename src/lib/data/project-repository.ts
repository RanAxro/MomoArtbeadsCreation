import type { BeadProject } from '$model/project.model';
import { DEFAULT_DUPLICATE_SUFFIX } from '$model/project.model';
import {
  DEFAULT_PROJECT_PALETTE_SOURCE,
  paletteSourceSchema
} from '$model/palette-source.model';
import type { ProjectSummary } from '$model/workspace.model';
import { getArtbeadsDatabase } from './database';

export type { ProjectSummary } from '$model/workspace.model';

export const projectRepository = {
  async list(): Promise<ProjectSummary[]> {
    const projects = await getArtbeadsDatabase()
      .projects.orderBy('updatedAt')
      .reverse()
      .toArray();
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      gameVersion: project.gameVersion,
      width: project.width,
      height: project.height,
      updatedAt: project.updatedAt,
      pixels: project.cells,
      palette: project.palette
    }));
  },

  async get(id: string): Promise<BeadProject | undefined> {
    const project = await getArtbeadsDatabase().projects.get(id);
    if (!project) {
      return undefined;
    }
    const paletteSource = paletteSourceSchema.safeParse(
      project.paletteSource
    );
    return {
      ...project,
      paletteSource: paletteSource.success
        ? paletteSource.data
        : { ...DEFAULT_PROJECT_PALETTE_SOURCE }
    };
  },

  async save(project: BeadProject): Promise<void> {
    await getArtbeadsDatabase().projects.put(project);
  },

  async rename(id: string, name: string): Promise<void> {
    await getArtbeadsDatabase().projects.update(id, {
      name,
      updatedAt: new Date().toISOString()
    });
  },

  async remove(id: string): Promise<void> {
    await getArtbeadsDatabase().projects.delete(id);
  },

  async duplicate(id: string): Promise<BeadProject | undefined> {
    const project = await this.get(id);
    if (!project) {
      return undefined;
    }

    const now = new Date().toISOString();
    const duplicate: BeadProject = {
      ...structuredClone(project),
      id: crypto.randomUUID(),
      name: `${project.name}${DEFAULT_DUPLICATE_SUFFIX}`,
      createdAt: now,
      updatedAt: now
    };
    await this.save(duplicate);
    return duplicate;
  },

  async clear(): Promise<void> {
    await getArtbeadsDatabase().projects.clear();
  }
};
