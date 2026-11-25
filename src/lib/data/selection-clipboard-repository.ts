import {
  SELECTION_CLIPBOARD_VERSION,
  type SelectionClipboard
} from '$model/selection-clipboard.model';
import { getArtbeadsDatabase } from './database';

export const selectionClipboardRepository = {
  async list(): Promise<SelectionClipboard[]> {
    const entries = await getArtbeadsDatabase()
      .selectionClipboard.toArray();
    return entries
      .filter((entry) => entry.version === SELECTION_CLIPBOARD_VERSION)
      .sort(compareClipboardRecency);
  },

  async save(clipboard: SelectionClipboard): Promise<void> {
    await getArtbeadsDatabase().selectionClipboard.put(clipboard);
  },

  async touch(id: string): Promise<void> {
    const database = getArtbeadsDatabase();
    const clipboard = await database.selectionClipboard.get(id);
    if (!clipboard) {
      return;
    }
    await database.selectionClipboard.put({
      ...clipboard,
      lastUsedAt: new Date().toISOString()
    });
  },

  async prune(limit: number): Promise<void> {
    const entries = await this.list();
    const expiredIds = entries.slice(limit).map((entry) => entry.id);
    if (expiredIds.length > 0) {
      await getArtbeadsDatabase().selectionClipboard.bulkDelete(expiredIds);
    }
  },

  async clear(): Promise<void> {
    await getArtbeadsDatabase().selectionClipboard.clear();
  }
};

function compareClipboardRecency(
  first: SelectionClipboard,
  second: SelectionClipboard
): number {
  const firstTime = first.lastUsedAt ?? first.copiedAt;
  const secondTime = second.lastUsedAt ?? second.copiedAt;
  return (
    secondTime.localeCompare(firstTime) ||
    second.copiedAt.localeCompare(first.copiedAt) ||
    second.id.localeCompare(first.id)
  );
}
