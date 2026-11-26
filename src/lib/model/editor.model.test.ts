import { describe, expect, it } from 'vitest';
import {
  EDITOR_TOOL_DEFINITIONS,
  EditorTool,
  EditorToolShortcut
} from './editor.model';

describe('editor tool definitions', () => {
  it('exposes color and rectangle selection as independent tools', () => {
    const colorSelect = EDITOR_TOOL_DEFINITIONS.find(
      (tool) => tool.id === EditorTool.ColorSelect
    );
    const rectangleSelect = EDITOR_TOOL_DEFINITIONS.find(
      (tool) => tool.id === EditorTool.Select
    );

    expect(colorSelect?.shortcut).toBe(EditorToolShortcut.ColorSelect);
    expect(rectangleSelect?.shortcut).toBe(EditorToolShortcut.Select);
    expect(colorSelect?.shortcut).not.toBe(rectangleSelect?.shortcut);
    expect(colorSelect?.icon).not.toBe(rectangleSelect?.icon);
  });
});
