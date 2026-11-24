import Dexie, { type Table } from 'dexie';
import type { BeadProject } from '$domain/project';

class MomoArtbeadsDatabase extends Dexie {
  projects!: Table<BeadProject, string>;

  constructor() {
    super('momo-artbeads');
    this.version(1).stores({
      projects: 'id, name, gameVersion, updatedAt, createdAt'
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

export interface ProjectSummary {
  id: string;
  name: string;
  gameVersion: string;
  width: number;
  height: number;
  updatedAt: string;
  pixels: number[];
  palette: BeadProject['palette'];
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
      name: `${project.name} 副本`,
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
