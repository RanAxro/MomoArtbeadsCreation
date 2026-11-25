import {
  SELECTION_CLIPBOARD_VERSION,
  SelectionClipboardRecordId,
  type SelectionClipboard
} from '$model/selection-clipboard.model';
import { getArtbeadsDatabase } from './database';

export const selectionClipboardRepository = {
  async get(): Promise<SelectionClipboard | undefined> {
    const clipboard = await getArtbeadsDatabase().selectionClipboard.get(
      SelectionClipboardRecordId.Active
    );
    return clipboard?.version === SELECTION_CLIPBOARD_VERSION
      ? clipboard
      : undefined;
  },

  async save(clipboard: SelectionClipboard): Promise<void> {
    await getArtbeadsDatabase().selectionClipboard.put(clipboard);
  },

  async clear(): Promise<void> {
    await getArtbeadsDatabase().selectionClipboard.delete(
      SelectionClipboardRecordId.Active
    );
  }
};
