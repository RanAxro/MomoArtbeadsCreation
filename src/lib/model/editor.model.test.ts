import { describe, expect, it } from 'vitest';
import {
  EDITOR_TOOL_DEFINITIONS,
  EditorTool,
  EditorToolShortcut
} from './editor.model';

describe('editor tool definitions', () => {
  it('exposes color, magic wand, and rectangle selection as independent tools', () => {
    const colorSelect = EDITOR_TOOL_DEFINITIONS.find(
      (tool) => tool.id === EditorTool.ColorSelect
    );
    const magicWand = EDITOR_TOOL_DEFINITIONS.find(
      (tool) => tool.id === EditorTool.MagicWand
    );
    const rectangleSelect = EDITOR_TOOL_DEFINITIONS.find(
      (tool) => tool.id === EditorTool.Select
    );

    expect(colorSelect?.shortcut).toBe(EditorToolShortcut.ColorSelect);
    expect(magicWand?.shortcut).toBe(EditorToolShortcut.MagicWand);
    expect(rectangleSelect?.shortcut).toBe(EditorToolShortcut.Select);
    expect(colorSelect?.shortcut).not.toBe(rectangleSelect?.shortcut);
    expect(new Set([
      colorSelect?.shortcut,
      magicWand?.shortcut,
      rectangleSelect?.shortcut
    ]).size).toBe(3);
    expect(new Set([
      colorSelect?.icon,
      magicWand?.icon,
      rectangleSelect?.icon
    ]).size).toBe(3);
  });
});
