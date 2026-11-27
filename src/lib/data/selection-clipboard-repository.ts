import {
  selectionClipboardSchema,
  type SelectionClipboard
} from '$model/selection-clipboard.model';
import { getArtbeadsDatabase } from './database';

export const selectionClipboardRepository = {
  async list(): Promise<SelectionClipboard[]> {
    const entries = await getArtbeadsDatabase()
      .selectionClipboard.toArray();
    return entries
      .flatMap((entry) => {
        const parsed = selectionClipboardSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
      .sort(compareClipboardRecency);
  },

  async save(clipboard: SelectionClipboard): Promise<void> {
    const parsed = selectionClipboardSchema.parse(clipboard);
    await getArtbeadsDatabase().selectionClipboard.put(parsed);
  },

  async touch(id: string): Promise<void> {
    const database = getArtbeadsDatabase();
    const clipboard = await database.selectionClipboard.get(id);
    if (!clipboard) {
      return;
    }
    const parsed = selectionClipboardSchema.safeParse(clipboard);
    if (!parsed.success) {
      return;
    }
    await database.selectionClipboard.put({
      ...parsed.data,
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
  const firstTime = Date.parse(first.lastUsedAt);
  const secondTime = Date.parse(second.lastUsedAt);
  return (
    secondTime - firstTime ||
    Date.parse(second.copiedAt) - Date.parse(first.copiedAt) ||
    second.id.localeCompare(first.id)
  );
}
