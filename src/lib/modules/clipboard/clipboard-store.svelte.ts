import { selectionClipboardRepository } from '$data/selection-clipboard-repository';
import {
  CLIPBOARD_HISTORY_LIMIT_STORAGE_KEY,
  DEFAULT_CLIPBOARD_HISTORY_LIMIT,
  MAX_CLIPBOARD_HISTORY_LIMIT,
  MIN_CLIPBOARD_HISTORY_LIMIT,
  type SelectionClipboard
} from '$model/selection-clipboard.model';

function readStoredLimit(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_CLIPBOARD_HISTORY_LIMIT;
  }

  const stored = Number.parseInt(
    window.localStorage.getItem(CLIPBOARD_HISTORY_LIMIT_STORAGE_KEY) ?? '',
    10
  );
  return Number.isFinite(stored)
    ? clampLimit(stored)
    : DEFAULT_CLIPBOARD_HISTORY_LIMIT;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CLIPBOARD_HISTORY_LIMIT;
  }
  return Math.max(
    MIN_CLIPBOARD_HISTORY_LIMIT,
    Math.min(MAX_CLIPBOARD_HISTORY_LIMIT, Math.round(value))
  );
}

class ClipboardStore {
  entries = $state<SelectionClipboard[]>([]);
  limit = $state(readStoredLimit());
  initialized = $state(false);
  private initialization: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (!this.initialization) {
      this.initialization = this.refresh().then(() => {
        this.initialized = true;
      });
    }
    await this.initialization;
  }

  async refresh(): Promise<void> {
    this.entries = (
      await selectionClipboardRepository.list()
    ).slice(0, this.limit);
  }

  async copy(clipboard: SelectionClipboard): Promise<void> {
    await selectionClipboardRepository.save(clipboard);
    await selectionClipboardRepository.prune(this.limit);
    await this.refresh();
  }

  async use(id: string): Promise<void> {
    await selectionClipboardRepository.touch(id);
    await selectionClipboardRepository.prune(this.limit);
    await this.refresh();
  }

  async setLimit(value: number): Promise<void> {
    this.limit = clampLimit(value);
    window.localStorage.setItem(
      CLIPBOARD_HISTORY_LIMIT_STORAGE_KEY,
      String(this.limit)
    );
    await selectionClipboardRepository.prune(this.limit);
    await this.refresh();
  }

  async clear(): Promise<void> {
    await selectionClipboardRepository.clear();
    this.entries = [];
  }
}

export const clipboardStore = new ClipboardStore();
