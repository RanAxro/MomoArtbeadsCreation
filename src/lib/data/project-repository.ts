import Dexie, { type Table } from 'dexie';
import type { BeadProject } from '$model/project.model';
import {
  PROJECT_DATABASE_NAME,
  PROJECT_DATABASE_VERSION,
  PROJECT_TABLE_INDEXES,
  PROJECT_TABLE_NAME
} from '$model/data.model';
import { DEFAULT_DUPLICATE_SUFFIX } from '$model/project.model';
import type { ProjectSummary } from '$model/workspace.model';

export type { ProjectSummary } from '$model/workspace.model';

class MomoArtbeadsDatabase extends Dexie {
  projects!: Table<BeadProject, string>;

  constructor() {
    super(PROJECT_DATABASE_NAME);
    this.version(PROJECT_DATABASE_VERSION).stores({
      [PROJECT_TABLE_NAME]: PROJECT_TABLE_INDEXES
    });
  }
}

let database: MomoArtbeadsDatabase | null = null;

function getDatabase(): MomoArtbeadsDatabase {
  if (!database) {
    database = new MomoArtbeadsDatabase();
  }
  return database;
}

export const projectRepository = {
  async list(): Promise<ProjectSummary[]> {
    const projects = await getDatabase().projects.orderBy('updatedAt').reverse().toArray();
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
    return getDatabase().projects.get(id);
  },

  async save(project: BeadProject): Promise<void> {
    await getDatabase().projects.put(project);
  },

  async rename(id: string, name: string): Promise<void> {
    await getDatabase().projects.update(id, {
      name,
      updatedAt: new Date().toISOString()
    });
  },

  async remove(id: string): Promise<void> {
    await getDatabase().projects.delete(id);
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
    await getDatabase().projects.clear();
  }
};
