import { describe, expect, it } from 'vitest';
import {
  BoardCodec,
  BoardCodecError,
  base64ToBytes,
  bytesToBase64,
  decodeBoardBase64,
  decodeBoardData,
  decodeShareCode,
  encodeBoardBase64,
  encodeBoardData,
  encodeShareCode,
  extractShareCodeBase64,
  type BoardTransferData
} from './board-codec';
import type { BeadPalette } from '$model/palette.model';
import { createProject } from '$domain/project';
import { beadProjectSchema } from '$model/project.model';

const HOME_SHARE_CODE =
  'home=TUFDAQQBGBgEaG9tZQ9BcnRiZWFkIFBhbGV0dGUK////SkpKioqKycnJ8ujY57ibyYdw56SzyUxoc1ONzQFtkVFuBDEIQ+M1Bib3P3BlsrPtaMtHpDwDhmQtBFjF9RVaTMU/grmSzJobJGmw0kIm6SpEx80Hy1VuHMJaEl04eNqRnaOe7LfgaFeRUgYQHyV7HZ7ChMYix2SVOpo9Quj29vAtgJOvkvTekF1GAMj+w/d2vhSAusYa5q+oMnOFqqiIw1VVNTi65eFOo1ddVdc1q/E80TE2vcqtC9o3RjApXuWV4jddCgZg3NyfdL+ql4qs558Bwx184LUIfXFPS4mbArYe/749tY+4d1o/lyjteg==';

function createTestPalette(): BeadPalette {
  return {
    id: 'test-palette',
    name: '测试色板',
    colors: [
      {
        id: 'black',
        name: '黑色',
        code: '01',
        hex: '#000000',
        stock: 12
      },
      {
        id: 'white',
        name: '白色',
        code: '02',
        hex: '#FFFFFF'
      },
      {
        id: 'blue',
        name: '蓝色',
        code: '03',
        hex: '#4E89B8',
        stock: 0
      }
    ]
  };
}

function createTransferData(
  width: number,
  height: number,
  cells: number[]
): BoardTransferData {
  return {
    name: '压缩测试方案',
    width,
    height,
    cells,
    palette: createTestPalette()
  };
}

describe('board binary codec', () => {
  it('round trips a sparse board and preserves used RGB colors', async () => {
    const data = createTransferData(6, 4, [
      0, 0, 1, 1, 0, 0,
      0, 2, 0, 0, 3, 0,
      1, 0, 0, 2, 0, 0,
      0, 0, 0, 0, 0, 3
    ]);

    const decoded = await decodeBoardBase64(await encodeBoardBase64(data));

    expect(decoded.name).toBe(data.name);
    expect(decoded.width).toBe(6);
    expect(decoded.height).toBe(4);
    expect(decoded.cells).toEqual(data.cells);
    expect(decoded.palette.name).toBe(data.palette.name);
    expect(decoded.palette.colors.map((color) => color.hex)).toEqual([
      '#000000',
      '#FFFFFF',
      '#4E89B8'
    ]);
    expect(decoded.palette.colors.map((color) => color.code)).toEqual([
      '01',
      '02',
      '03'
    ]);
    expect(decoded.palette.colors.map((color) => color.name)).toEqual([
      'A01',
      'A02',
      'A03'
    ]);
    expect(decoded.palette.colors.some((color) => color.stock !== undefined))
      .toBe(false);
  });

  it('round trips a fully filled board without an empty symbol', async () => {
    const cells = Array.from({ length: 10 * 7 }, (_, index) =>
      (index % 3) + 1
    );
    const data = createTransferData(10, 7, cells);

    const decoded = await decodeBoardData(await encodeBoardData(data));

    expect(decoded.cells).toEqual(cells);
    expect(decoded.cells).not.toContain(0);
  });

  it('round trips a board with one repeated color and no empty cells', async () => {
    const cells = Array.from({ length: 20 * 15 }, () => 2);
    const data = createTransferData(20, 15, cells);

    const encoded = await encodeBoardData(data);
    const decoded = await decodeBoardData(encoded);

    expect(encoded[4]).toBe(BoardCodec.Constant);
    expect(decoded.cells.every((cell) => cell === 1)).toBe(true);
    expect(decoded.palette.colors).toHaveLength(1);
    expect(decoded.palette.colors[0].hex).toBe('#FFFFFF');
  });

  it('round trips a completely empty board', async () => {
    const data = createTransferData(
      30,
      20,
      Array.from({ length: 30 * 20 }, () => 0)
    );

    const encoded = await encodeBoardData(data);
    const decoded = await decodeBoardData(encoded);

    expect(encoded[4]).toBe(BoardCodec.Constant);
    expect(decoded.cells.every((cell) => cell === 0)).toBe(true);
    expect(decoded.palette.colors.length).toBeGreaterThan(0);
  });

  it('selects the Huffman stream for a small frequency-skewed board', async () => {
    const cells = Array.from({ length: 64 }, (_, index) =>
      index < 58 ? 0 : (index % 3) + 1
    );
    const encoded = await encodeBoardData(createTransferData(8, 8, cells));

    expect(encoded[4]).toBe(BoardCodec.Huffman);
    expect((await decodeBoardData(encoded)).cells).toEqual(cells);
  });

  it('selects RLE for two long solid runs', async () => {
    const cells = Array.from({ length: 90_000 }, (_, index) =>
      index < 45_000 ? 0 : 1
    );
    const encoded = await encodeBoardData(
      createTransferData(300, 300, cells)
    );

    expect(encoded[4]).toBe(BoardCodec.Rle);
    expect((await decodeBoardData(encoded)).cells).toEqual(cells);
  });

  it('compresses a skew-heavy board below three bytes per cell', async () => {
    const cells = Array.from({ length: 120 * 80 }, (_, index) => {
      if (index % 10 !== 0) {
        return 0;
      }
      return (index % 3) + 1;
    });
    const data = createTransferData(120, 80, cells);

    const encoded = await encodeBoardData(data);
    const decoded = await decodeBoardData(encoded);

    expect(decoded.cells).toEqual(cells);
    expect(encoded.length).toBeLessThan(cells.length * 3);
  });

  it('supports every candidate codec payload type', async () => {
    const data = createTransferData(12, 8, [
      1, 1, 1, 1, 2, 2, 1, 2, 1, 2, 1, 2,
      1, 1, 2, 2, 2, 1, 1, 2, 0, 0, 0, 0,
      1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2,
      0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 0,
      1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2,
      0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 0, 0,
      2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 0,
      0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0
    ]);

    const encoded = await encodeBoardData(data);
    expect(Object.values(BoardCodec)).toContain(encoded[4]);
    expect(await decodeBoardData(encoded)).toMatchObject({
      width: data.width,
      height: data.height,
      cells: data.cells
    });
  });

  it('round trips through base64 without padding problems', async () => {
    const data = createTransferData(2, 2, [0, 1, 2, 3]);
    const encoded = await encodeBoardBase64(data);

    expect(await decodeBoardBase64(encoded)).toMatchObject({
      width: 2,
      height: 2,
      cells: data.cells
    });
  });

  it('round trips a share code whose scheme name contains equals signs', async () => {
    const data = {
      ...createTransferData(2, 2, [0, 1, 2, 3]),
      name: '拼绘=分享=方案'
    };
    const shareCode = await encodeShareCode(data);

    expect(shareCode.startsWith(`${data.name}=`)).toBe(true);
    expect(await decodeShareCode(shareCode)).toMatchObject({
      name: data.name,
      width: 2,
      height: 2,
      cells: data.cells
    });
  });

  it('accepts either a named share code or raw compressed Base64', async () => {
    const data = createTransferData(2, 2, [0, 1, 2, 3]);
    const namedShareCode = await encodeShareCode(data);
    const rawBase64 = await encodeBoardBase64(data);

    expect(await decodeShareCode(namedShareCode)).toMatchObject({
      name: data.name,
      cells: data.cells
    });
    expect(await decodeShareCode(rawBase64)).toMatchObject({
      name: data.name,
      cells: data.cells
    });
  });

  it('extracts Base64 data while preserving trailing padding', () => {
    expect(extractShareCodeBase64('方案=YWJjZA==')).toBe('YWJjZA==');
    expect(extractShareCodeBase64('A=B=YWJjZA==')).toBe('YWJjZA==');
    expect(extractShareCodeBase64('方案=YWJjZA')).toBe('YWJjZA');
    expect(extractShareCodeBase64('YWJjZA==')).toBe('YWJjZA==');
  });

  it('rejects corrupted binary data using the checksum', async () => {
    const encoded = await encodeBoardData(
      createTransferData(3, 3, [0, 1, 0, 2, 0, 3, 0, 1, 0])
    );
    const corrupted = encoded.slice();
    corrupted[Math.floor(corrupted.length / 2)] ^= 0x01;

    await expect(decodeBoardData(corrupted)).rejects.toMatchObject({
      code: 'checksum'
    });
  });

  it('rejects malformed base64 input', () => {
    expect(() => base64ToBytes('not base64!')).toThrow(BoardCodecError);
    expect(() => base64ToBytes('A')).toThrow(BoardCodecError);
  });

  it('keeps base64 encoding canonical and lossless', () => {
    const bytes = Uint8Array.of(0, 1, 2, 250, 251, 252);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('decodes the home share code into a valid project', async () => {
    const data = await decodeShareCode(HOME_SHARE_CODE);
    const project = createProject({
      name: data.name,
      width: data.width,
      height: data.height,
      palette: data.palette
    });
    project.cells = [...data.cells];

    expect(() => beadProjectSchema.parse(project)).not.toThrow();
    expect(project.name).toBe('home');
    expect(project.width).toBe(24);
    expect(project.height).toBe(24);
    expect(project.cells).toHaveLength(24 * 24);
  });
});
