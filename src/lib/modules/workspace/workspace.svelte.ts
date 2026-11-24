import { projectRepository, type ProjectSummary } from '$data/project-repository';
import { normalizeProjectName, type BeadProject } from '$domain/project';
import { EditorStore } from '$modules/editor/editor-store.svelte';

const ACTIVE_SCHEME_KEY = 'momo-artbeads.active-scheme';

class WorkspaceStore {
  projects = $state<ProjectSummary[]>([]);
  activeId = $state<string | null>(null);
  initialized = $state(false);
  editor = new EditorStore();
  private initialization: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.initialization) {
      this.initialization = (async () => {
        await this.refresh();
        const remembered = window.localStorage.getItem(ACTIVE_SCHEME_KEY);
        if (remembered && this.projects.some((project) => project.id === remembered)) {
          await this.select(remembered);
        }
        this.initialized = true;
      })();
    }
    await this.initialization;
  }

  async refresh(): Promise<void> {
    this.projects = await projectRepository.list();
    if (this.activeId && !this.projects.some((project) => project.id === this.activeId)) {
      this.close();
    }
  }

  async select(id: string): Promise<boolean> {
    if (this.activeId === id && this.editor.project) {
      return true;
    }

    await this.saveActiveScheme();
    const project = await projectRepository.get(id);
    if (!project) {
      return false;
    }

    this.activeId = id;
    this.editor.load(project);
    window.localStorage.setItem(ACTIVE_SCHEME_KEY, id);
    return true;
  }

  async create(project: BeadProject): Promise<void> {
    await projectRepository.save(project);
    await this.refresh();
    await this.select(project.id);
  }

  async saveActiveScheme(): Promise<void> {
    if (!this.editor.project || this.editor.revision === this.editor.savedRevision) {
      return;
    }

    const snapshot = this.editor.toSnapshot();
    if (!snapshot) {
      return;
    }

    const revision = this.editor.revision;
    await projectRepository.save(snapshot);
    this.editor.markSaved(revision);
    this.updateProjectSummary(snapshot);
  }

  updateProjectSummary(project: BeadProject): void {
    const knownScheme = this.projects.some((candidate) => candidate.id === project.id);
    if (!knownScheme && this.activeId !== project.id) {
      return;
    }

    const summary: ProjectSummary = {
      id: project.id,
      name: project.name,
      gameVersion: project.gameVersion,
      width: project.width,
      height: project.height,
      updatedAt: project.updatedAt,
      pixels: project.cells,
      palette: project.palette
    };
    this.projects = [
      summary,
      ...this.projects.filter((candidate) => candidate.id !== project.id)
    ].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  }

  async renameScheme(id: string, name: string): Promise<void> {
    const nextName = normalizeProjectName(name);
    if (!nextName) {
      throw new Error('Scheme name cannot be empty');
    }

    await projectRepository.rename(id, nextName);
    if (this.activeId === id && this.editor.project) {
      this.editor.project.name = nextName;
    }
    this.projects = await projectRepository.list();
  }

  async deleteScheme(id: string): Promise<void> {
    const deletingActiveScheme = this.activeId === id;
    if (deletingActiveScheme) {
      this.activeId = null;
      this.editor.close();
      window.localStorage.removeItem(ACTIVE_SCHEME_KEY);
    }

    try {
      await projectRepository.remove(id);
    } catch (error) {
      if (deletingActiveScheme) {
        const project = await projectRepository.get(id);
        if (project) {
          this.activeId = id;
          this.editor.load(project);
          window.localStorage.setItem(ACTIVE_SCHEME_KEY, id);
        }
      }
      throw error;
    }

    this.projects = await projectRepository.list();
  }

  close(remember = true): void {
    void this.saveActiveScheme();
    this.activeId = null;
    this.editor.close();
    if (remember) {
      window.localStorage.removeItem(ACTIVE_SCHEME_KEY);
    }
  }
}

export const workspace = new WorkspaceStore();
