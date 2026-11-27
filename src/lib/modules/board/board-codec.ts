import {
  hexToRgb,
  isHexColor,
  rgbToHex
} from '$domain/color';
import {
  DEFAULT_PROJECT_NAME,
  MAX_PROJECT_DIMENSION,
  MIN_PROJECT_DIMENSION
} from '$model/project.model';
import {
  BeadShape,
  isBeadShape
} from '$model/bead-shape.model';
import {
  DEFAULT_PALETTE_COLOR_PREFIX,
  DEFAULT_PALETTE_NAME,
  PALETTE_CODE_PAD_LENGTH,
  PALETTE_MAX_COLORS,
  type BeadPalette
} from '$model/palette.model';
import { createStarterPalette } from '$domain/palette';

const MAGIC = Uint8Array.of(0x4d, 0x41, 0x43);
const FORMAT_VERSION = 1;
const FLAG_HAS_EMPTY = 1;
const MAX_CODE_LENGTH = 15;
const MAX_TRANSFER_BYTES = 16 * 1024 * 1024;
const MIN_DEFLATE_SOURCE_BYTES = 64;
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BEAD_SHAPE_BY_BYTE: readonly BeadShape[] = [
  BeadShape.Square,
  BeadShape.Circle,
  BeadShape.Hexagon
];

export enum BoardCodec {
  Constant = 0,
  Fixed = 1,
  Huffman = 2,
  Rle = 3,
  DeflatedSymbols = 4,
  DeflatedFixed = 5,
  DeflatedRle = 6
}

export type BoardCodecErrorCode =
  | 'invalid-base64'
  | 'invalid-format'
  | 'unsupported-version'
  | 'unsupported-codec'
  | 'checksum'
  | 'invalid-dimensions'
  | 'invalid-data'
  | 'compression-unavailable';

export class BoardCodecError extends Error {
  constructor(
    public readonly code: BoardCodecErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'BoardCodecError';
  }
}

export interface BoardTransferData {
  name: string;
  width: number;
  height: number;
  beadShape: BeadShape;
  cells: number[];
  palette: BeadPalette;
}

interface RgbTuple {
  r: number;
  g: number;
  b: number;
}

interface EncodedCandidate {
  codec: BoardCodec;
  payload: Uint8Array;
  priority: number;
}

interface HuffmanNode {
  weight: number;
  minimumSymbol: number;
  symbol?: number;
  left?: HuffmanNode;
  right?: HuffmanNode;
}

class ByteWriter {
  private bytes: number[] = [];

  writeByte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  writeBytes(value: Uint8Array): void {
    for (const byte of value) {
      this.bytes.push(byte);
    }
  }

  writeVarUint(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new BoardCodecError('invalid-data', 'Invalid unsigned integer.');
    }

    let remaining = value;
    do {
      let byte = remaining % 128;
      remaining = Math.floor(remaining / 128);
      if (remaining > 0) {
        byte |= 0x80;
      }
      this.writeByte(byte);
    } while (remaining > 0);
  }

  writeUint32(value: number): void {
    this.writeByte(value & 0xff);
    this.writeByte((value >>> 8) & 0xff);
    this.writeByte((value >>> 16) & 0xff);
    this.writeByte((value >>> 24) & 0xff);
  }

  writeString(value: string): void {
    const bytes = new TextEncoder().encode(value);
    this.writeVarUint(bytes.length);
    this.writeBytes(bytes);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class ByteReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  readByte(): number {
    if (this.offset >= this.bytes.length) {
      throw new BoardCodecError('invalid-format', 'Unexpected end of data.');
    }
    return this.bytes[this.offset++];
  }

  readBytes(length: number): Uint8Array {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > this.remaining
    ) {
      throw new BoardCodecError('invalid-format', 'Invalid byte length.');
    }
    const result = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  readVarUint(): number {
    let value = 0;
    let multiplier = 1;
    for (let index = 0; index < 8; index += 1) {
      const byte = this.readByte();
      value += (byte & 0x7f) * multiplier;
      if (!Number.isSafeInteger(value)) {
        throw new BoardCodecError('invalid-data', 'Integer is too large.');
      }
      if ((byte & 0x80) === 0) {
        return value;
      }
      multiplier *= 128;
    }
    throw new BoardCodecError('invalid-data', 'Invalid variable integer.');
  }

  readString(): string {
    const length = this.readVarUint();
    const bytes = this.readBytes(length);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new BoardCodecError('invalid-data', 'Invalid UTF-8 string.');
    }
  }
}

class BitWriter {
  private readonly bytes: number[] = [];
  private current = 0;
  private usedBits = 0;

  write(value: number, bitCount: number): void {
    for (let shift = bitCount - 1; shift >= 0; shift -= 1) {
      this.current = (this.current << 1) | ((value >>> shift) & 1);
      this.usedBits += 1;
      if (this.usedBits === 8) {
        this.bytes.push(this.current);
        this.current = 0;
        this.usedBits = 0;
      }
    }
  }

  finish(): Uint8Array {
    if (this.usedBits > 0) {
      this.bytes.push(this.current << (8 - this.usedBits));
    }
    return Uint8Array.from(this.bytes);
  }
}

class BitReader {
  private bitOffset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get remainingBits(): number {
    return this.bytes.length * 8 - this.bitOffset;
  }

  read(bitCount: number): number | null {
    if (this.bitOffset + bitCount > this.bytes.length * 8) {
      return null;
    }

    let value = 0;
    for (let index = 0; index < bitCount; index += 1) {
      const byte = this.bytes[this.bitOffset >>> 3];
      const bit = (byte >>> (7 - (this.bitOffset & 7))) & 1;
      value = (value << 1) | bit;
      this.bitOffset += 1;
    }
    return value;
  }
}

interface HuffmanCode {
  lengths: number[];
  codes: number[];
  payload: Uint8Array;
}

interface HuffmanDecodeNode {
  children: [number, number];
  symbol: number;
}

function bitWidth(symbolCount: number): number {
  return Math.max(1, Math.ceil(Math.log2(symbolCount)));
}

function encodeFixed(symbols: Uint8Array, symbolCount: number): Uint8Array {
  const width = bitWidth(symbolCount);
  const writer = new BitWriter();
  for (const symbol of symbols) {
    writer.write(symbol, width);
  }
  return writer.finish();
}

function decodeFixed(
  payload: Uint8Array,
  symbolCount: number,
  cellCount: number
): Uint8Array {
  const width = bitWidth(symbolCount);
  const expectedBytes = Math.ceil((cellCount * width) / 8);
  if (payload.length !== expectedBytes) {
    throw new BoardCodecError('invalid-data', 'Invalid fixed payload length.');
  }

  const reader = new BitReader(payload);
  const result = new Uint8Array(cellCount);
  for (let index = 0; index < cellCount; index += 1) {
    const symbol = reader.read(width);
    if (symbol === null || symbol >= symbolCount) {
      throw new BoardCodecError('invalid-data', 'Invalid fixed symbol.');
    }
    result[index] = symbol;
  }
  return result;
}

function createHuffmanTree(
  frequencies: Uint32Array
): HuffmanNode | null {
  const nodes: HuffmanNode[] = [];
  for (let symbol = 0; symbol < frequencies.length; symbol += 1) {
    if (frequencies[symbol] > 0) {
      nodes.push({
        weight: frequencies[symbol],
        minimumSymbol: symbol,
        symbol
      });
    }
  }

  if (nodes.length <= 1) {
    return nodes[0] ?? null;
  }

  while (nodes.length > 1) {
    nodes.sort(
      (first, second) =>
        first.weight - second.weight ||
        first.minimumSymbol - second.minimumSymbol
    );
    const first = nodes.shift();
    const second = nodes.shift();
    if (!first || !second) {
      return null;
    }
    nodes.push({
      weight: first.weight + second.weight,
      minimumSymbol: Math.min(first.minimumSymbol, second.minimumSymbol),
      left: first,
      right: second
    });
  }

  return nodes[0];
}

function huffmanLengths(root: HuffmanNode, symbolCount: number): number[] | null {
  const lengths = Array.from({ length: symbolCount }, () => 0);
  const stack: Array<{ node: HuffmanNode; depth: number }> = [
    { node: root, depth: 0 }
  ];

  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) {
      return null;
    }
    const { node, depth } = entry;
    if (node.symbol !== undefined) {
      if (depth < 1 || depth > MAX_CODE_LENGTH) {
        return null;
      }
      lengths[node.symbol] = depth;
      continue;
    }
    if (node.left) {
      stack.push({ node: node.left, depth: depth + 1 });
    }
    if (node.right) {
      stack.push({ node: node.right, depth: depth + 1 });
    }
  }

  return lengths.every((length) => length > 0) ? lengths : null;
}

function canonicalHuffmanCodes(lengths: number[]): number[] {
  const symbols = lengths
    .map((length, symbol) => ({ length, symbol }))
    .sort(
      (first, second) =>
        first.length - second.length || first.symbol - second.symbol
    );
  const codes = Array.from({ length: lengths.length }, () => 0);
  let code = 0;
  let previousLength = symbols[0]?.length ?? 0;

  for (let index = 0; index < symbols.length; index += 1) {
    const entry = symbols[index];
    if (index > 0) {
      code = (code + 1) << (entry.length - previousLength);
    }
    codes[entry.symbol] = code;
    previousLength = entry.length;
  }

  return codes;
}

function encodeHuffman(
  symbols: Uint8Array,
  frequencies: Uint32Array
): HuffmanCode | null {
  const root = createHuffmanTree(frequencies);
  if (!root) {
    return null;
  }

  const lengths = huffmanLengths(root, frequencies.length);
  if (!lengths) {
    return null;
  }

  const codes = canonicalHuffmanCodes(lengths);
  const writer = new ByteWriter();
  for (let index = 0; index < lengths.length; index += 2) {
    const high = lengths[index];
    const low = lengths[index + 1] ?? 0;
    writer.writeByte((high << 4) | low);
  }

  const bits = new BitWriter();
  for (const symbol of symbols) {
    bits.write(codes[symbol], lengths[symbol]);
  }
  writer.writeBytes(bits.finish());

  return {
    lengths,
    codes,
    payload: writer.finish()
  };
}

function buildHuffmanDecoder(
  lengths: number[],
  codes: number[]
): HuffmanDecodeNode[] {
  const root: HuffmanDecodeNode = {
    children: [-1, -1],
    symbol: -1
  };
  const nodes = [root];

  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const length = lengths[symbol];
    if (length < 1 || length > MAX_CODE_LENGTH) {
      throw new BoardCodecError('invalid-data', 'Invalid Huffman length.');
    }

    let nodeIndex = 0;
    for (let shift = length - 1; shift >= 0; shift -= 1) {
      if (nodes[nodeIndex].symbol >= 0) {
        throw new BoardCodecError('invalid-data', 'Invalid Huffman prefix.');
      }
      const bit = (codes[symbol] >>> shift) & 1;
      let childIndex = nodes[nodeIndex].children[bit];
      if (childIndex < 0) {
        childIndex = nodes.length;
        nodes.push({ children: [-1, -1], symbol: -1 });
        nodes[nodeIndex].children[bit] = childIndex;
      }
      nodeIndex = childIndex;
    }

    if (
      nodes[nodeIndex].symbol >= 0 ||
      nodes[nodeIndex].children[0] >= 0 ||
      nodes[nodeIndex].children[1] >= 0
    ) {
      throw new BoardCodecError('invalid-data', 'Duplicate Huffman code.');
    }
    nodes[nodeIndex].symbol = symbol;
  }

  return nodes;
}

function decodeHuffman(
  payload: Uint8Array,
  symbolCount: number,
  cellCount: number
): Uint8Array {
  if (symbolCount < 2) {
    throw new BoardCodecError('invalid-data', 'Invalid Huffman alphabet.');
  }

  const lengthTableBytes = Math.ceil(symbolCount / 2);
  if (payload.length < lengthTableBytes) {
    throw new BoardCodecError('invalid-data', 'Missing Huffman table.');
  }

  const lengths: number[] = [];
  for (let index = 0; index < symbolCount; index += 1) {
    const byte = payload[index >>> 1];
    lengths.push(index % 2 === 0 ? byte >>> 4 : byte & 0x0f);
  }

  if (lengths.some((length) => length === 0)) {
    throw new BoardCodecError('invalid-data', 'Incomplete Huffman table.');
  }

  const codes = canonicalHuffmanCodes(lengths);
  const nodes = buildHuffmanDecoder(lengths, codes);
  const payloadBits = payload.subarray(lengthTableBytes);
  const reader = new BitReader(payloadBits);
  const result = new Uint8Array(cellCount);

  for (let cell = 0; cell < cellCount; cell += 1) {
    let nodeIndex = 0;
    while (nodes[nodeIndex].symbol < 0) {
      const bit = reader.read(1);
      if (bit === null) {
        throw new BoardCodecError('invalid-data', 'Truncated Huffman data.');
      }
      nodeIndex = nodes[nodeIndex].children[bit];
      if (nodeIndex < 0) {
        throw new BoardCodecError('invalid-data', 'Invalid Huffman code.');
      }
    }
    result[cell] = nodes[nodeIndex].symbol;
  }

  return result;
}

function encodeRle(symbols: Uint8Array): Uint8Array {
  const writer = new ByteWriter();
  let start = 0;

  while (start < symbols.length) {
    let end = start + 1;
    while (end < symbols.length && symbols[end] === symbols[start]) {
      end += 1;
    }
    writer.writeVarUint(end - start);
    writer.writeByte(symbols[start]);
    start = end;
  }

  return writer.finish();
}

function decodeRle(
  payload: Uint8Array,
  symbolCount: number,
  cellCount: number
): Uint8Array {
  const reader = new ByteReader(payload);
  const result = new Uint8Array(cellCount);
  let offset = 0;

  while (offset < cellCount) {
    const runLength = reader.readVarUint();
    if (runLength < 1 || runLength > cellCount - offset) {
      throw new BoardCodecError('invalid-data', 'Invalid RLE run length.');
    }
    const symbol = reader.readByte();
    if (symbol >= symbolCount) {
      throw new BoardCodecError('invalid-data', 'Invalid RLE symbol.');
    }
    result.fill(symbol, offset, offset + runLength);
    offset += runLength;
  }

  if (reader.remaining !== 0) {
    throw new BoardCodecError('invalid-data', 'Unexpected RLE data.');
  }
  return result;
}

async function deflateRaw(
  bytes: Uint8Array
): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') {
    return null;
  }
  try {
    const source = new Uint8Array(bytes.length);
    source.set(bytes);
    const stream = new Blob([source.buffer])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new BoardCodecError(
      'compression-unavailable',
      'DEFLATE decompression is unavailable.'
    );
  }
  try {
    const source = new Uint8Array(bytes.length);
    source.set(bytes);
    const stream = new Blob([source.buffer])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new BoardCodecError('invalid-data', 'Invalid DEFLATE data.');
  }
}

function decodeSymbolBytes(
  bytes: Uint8Array,
  symbolCount: number,
  cellCount: number
): Uint8Array {
  if (bytes.length !== cellCount) {
    throw new BoardCodecError('invalid-data', 'Invalid symbol data length.');
  }
  for (const symbol of bytes) {
    if (symbol >= symbolCount) {
      throw new BoardCodecError('invalid-data', 'Invalid symbol value.');
    }
  }
  return bytes;
}

async function createCandidates(
  symbols: Uint8Array,
  frequencies: Uint32Array
): Promise<EncodedCandidate[]> {
  const symbolCount = frequencies.length;
  const candidates: EncodedCandidate[] = [];
  const usedSymbols = Array.from(frequencies).filter(
    (frequency) => frequency > 0
  ).length;

  if (usedSymbols === 1) {
    const writer = new ByteWriter();
    writer.writeVarUint(symbols[0] ?? 0);
    candidates.push({
      codec: BoardCodec.Constant,
      payload: writer.finish(),
      priority: 0
    });
  } else {
    const fixed = encodeFixed(symbols, symbolCount);
    const rle = encodeRle(symbols);
    const huffman = encodeHuffman(symbols, frequencies);
    candidates.push(
      { codec: BoardCodec.Fixed, payload: fixed, priority: 5 },
      { codec: BoardCodec.Rle, payload: rle, priority: 3 }
    );
    if (huffman) {
      candidates.push({
        codec: BoardCodec.Huffman,
        payload: huffman.payload,
        priority: 2
      });
    }

    const shouldTryDeflate = fixed.length >= MIN_DEFLATE_SOURCE_BYTES;
    const [symbolBytes, fixedBytes, rleBytes] = shouldTryDeflate
      ? await Promise.all([
          deflateRaw(symbols),
          deflateRaw(fixed),
          deflateRaw(rle)
        ])
      : [null, null, null];
    if (symbolBytes) {
      candidates.push({
        codec: BoardCodec.DeflatedSymbols,
        payload: symbolBytes,
        priority: 1
      });
    }
    if (fixedBytes) {
      candidates.push({
        codec: BoardCodec.DeflatedFixed,
        payload: fixedBytes,
        priority: 4
      });
    }
    if (rleBytes) {
      candidates.push({
        codec: BoardCodec.DeflatedRle,
        payload: rleBytes,
        priority: 6
      });
    }
  }

  return candidates.sort(
    (first, second) =>
      first.payload.length - second.payload.length ||
      first.priority - second.priority
  );
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_PROJECT_DIMENSION ||
    height < MIN_PROJECT_DIMENSION ||
    width > MAX_PROJECT_DIMENSION ||
    height > MAX_PROJECT_DIMENSION
  ) {
    throw new BoardCodecError('invalid-dimensions', 'Invalid board dimensions.');
  }
}

function beadShapeToByte(shape: BeadShape): number {
  const value = BEAD_SHAPE_BY_BYTE.indexOf(shape);
  if (value < 0) {
    throw new BoardCodecError('invalid-data', 'Invalid bead shape.');
  }
  return value;
}

function beadShapeFromByte(value: number): BeadShape {
  const shape = BEAD_SHAPE_BY_BYTE[value];
  if (!shape) {
    throw new BoardCodecError('invalid-data', 'Invalid bead shape.');
  }
  return shape;
}

function validateTransferData(data: BoardTransferData): void {
  assertDimensions(data.width, data.height);
  if (!isBeadShape(data.beadShape)) {
    throw new BoardCodecError('invalid-data', 'Invalid bead shape.');
  }
  if (data.cells.length !== data.width * data.height) {
    throw new BoardCodecError('invalid-data', 'Cell count does not match size.');
  }
  if (
    data.palette.colors.length < 1 ||
    data.palette.colors.length > PALETTE_MAX_COLORS
  ) {
    throw new BoardCodecError('invalid-data', 'Invalid palette size.');
  }

  for (const cell of data.cells) {
    if (
      !Number.isInteger(cell) ||
      cell < 0 ||
      cell > data.palette.colors.length
    ) {
      throw new BoardCodecError('invalid-data', 'Invalid cell color index.');
    }
  }
}

function collectColorRecords(
  data: BoardTransferData
): {
  records: RgbTuple[];
  symbolByPaletteIndex: Int16Array;
  hasEmpty: boolean;
} {
  const counts = new Uint32Array(data.palette.colors.length);
  let hasEmpty = false;
  for (const cell of data.cells) {
    if (cell === 0) {
      hasEmpty = true;
    } else {
      counts[cell - 1] += 1;
    }
  }

  const records: RgbTuple[] = [];
  const symbolByPaletteIndex = new Int16Array(data.palette.colors.length + 1);
  symbolByPaletteIndex.fill(-1);
  const symbolBase = hasEmpty ? 1 : 0;

  counts.forEach((count, index) => {
    if (count === 0) {
      return;
    }
    const color = data.palette.colors[index];
    if (!isHexColor(color.hex)) {
      throw new BoardCodecError('invalid-data', 'Invalid palette color.');
    }
    const rgb = hexToRgb(color.hex);
    symbolByPaletteIndex[index + 1] = symbolBase + records.length;
    records.push({
      r: rgb.r,
      g: rgb.g,
      b: rgb.b
    });
  });

  return { records, symbolByPaletteIndex, hasEmpty };
}

export async function encodeBoardData(
  data: BoardTransferData
): Promise<Uint8Array> {
  validateTransferData(data);
  const { records, symbolByPaletteIndex, hasEmpty } =
    collectColorRecords(data);
  const symbolCount = records.length + (hasEmpty ? 1 : 0);
  const symbols = new Uint8Array(data.cells.length);
  const frequencies = new Uint32Array(symbolCount);

  for (let index = 0; index < data.cells.length; index += 1) {
    const cell = data.cells[index];
    const symbol =
      cell === 0 ? 0 : symbolByPaletteIndex[cell];
    if (symbol < 0 || symbol >= symbolCount) {
      throw new BoardCodecError('invalid-data', 'Invalid symbol mapping.');
    }
    symbols[index] = symbol;
    frequencies[symbol] += 1;
  }

  const candidates = await createCandidates(symbols, frequencies);
  const selected = candidates[0];
  if (!selected) {
    throw new BoardCodecError('invalid-data', 'No encoder candidate available.');
  }

  const writer = new ByteWriter();
  writer.writeBytes(MAGIC);
  writer.writeByte(FORMAT_VERSION);
  writer.writeByte(selected.codec);
  writer.writeByte(hasEmpty ? FLAG_HAS_EMPTY : 0);
  writer.writeByte(beadShapeToByte(data.beadShape));
  writer.writeVarUint(data.width);
  writer.writeVarUint(data.height);
  writer.writeString(data.name);
  writer.writeString(data.palette.name);
  writer.writeVarUint(records.length);
  for (const record of records) {
    writer.writeByte(record.r);
    writer.writeByte(record.g);
    writer.writeByte(record.b);
  }
  writer.writeVarUint(selected.payload.length);
  writer.writeBytes(selected.payload);

  const content = writer.finish();
  const output = new Uint8Array(content.length + 4);
  output.set(content);
  const checksum = crc32(content);
  output[content.length] = checksum & 0xff;
  output[content.length + 1] = (checksum >>> 8) & 0xff;
  output[content.length + 2] = (checksum >>> 16) & 0xff;
  output[content.length + 3] = (checksum >>> 24) & 0xff;
  return output;
}

async function decodeSymbols(
  codec: BoardCodec,
  payload: Uint8Array,
  symbolCount: number,
  cellCount: number
): Promise<Uint8Array> {
  switch (codec) {
    case BoardCodec.Constant: {
      const reader = new ByteReader(payload);
      const symbol = reader.readVarUint();
      if (symbol >= symbolCount || reader.remaining !== 0) {
        throw new BoardCodecError('invalid-data', 'Invalid constant data.');
      }
      return new Uint8Array(cellCount).fill(symbol);
    }
    case BoardCodec.Fixed:
      return decodeFixed(payload, symbolCount, cellCount);
    case BoardCodec.Huffman:
      return decodeHuffman(payload, symbolCount, cellCount);
    case BoardCodec.Rle:
      return decodeRle(payload, symbolCount, cellCount);
    case BoardCodec.DeflatedSymbols:
      return decodeSymbolBytes(
        await inflateRaw(payload),
        symbolCount,
        cellCount
      );
    case BoardCodec.DeflatedFixed:
      return decodeFixed(await inflateRaw(payload), symbolCount, cellCount);
    case BoardCodec.DeflatedRle:
      return decodeRle(await inflateRaw(payload), symbolCount, cellCount);
    default:
      throw new BoardCodecError('unsupported-codec', 'Unsupported codec.');
  }
}

export async function decodeBoardData(
  encoded: Uint8Array
): Promise<BoardTransferData> {
  if (encoded.length < MAGIC.length + 4) {
    throw new BoardCodecError('invalid-format', 'Data is too short.');
  }

  const contentLength = encoded.length - 4;
  const content = encoded.subarray(0, contentLength);
  const expectedCrc =
    (encoded[contentLength] |
      (encoded[contentLength + 1] << 8) |
      (encoded[contentLength + 2] << 16) |
      (encoded[contentLength + 3] << 24)) >>>
    0;
  if (crc32(content) !== expectedCrc) {
    throw new BoardCodecError('checksum', 'Checksum verification failed.');
  }

  const reader = new ByteReader(content);
  const magic = reader.readBytes(MAGIC.length);
  if (!magic.every((byte, index) => byte === MAGIC[index])) {
    throw new BoardCodecError('invalid-format', 'Unknown data format.');
  }

  const version = reader.readByte();
  if (version !== FORMAT_VERSION) {
    throw new BoardCodecError(
      'unsupported-version',
      `Unsupported format version ${version}.`
    );
  }

  const codec = reader.readByte() as BoardCodec;
  const flags = reader.readByte();
  if ((flags & ~FLAG_HAS_EMPTY) !== 0) {
    throw new BoardCodecError('invalid-data', 'Unknown format flags.');
  }
  const beadShape = beadShapeFromByte(reader.readByte());

  const width = reader.readVarUint();
  const height = reader.readVarUint();
  assertDimensions(width, height);
  const name = reader.readString();
  const paletteName = reader.readString();
  const colorCount = reader.readVarUint();
  if (colorCount > PALETTE_MAX_COLORS) {
    throw new BoardCodecError('invalid-data', 'Too many palette colors.');
  }

  const records: RgbTuple[] = [];
  for (let index = 0; index < colorCount; index += 1) {
    const r = reader.readByte();
    const g = reader.readByte();
    const b = reader.readByte();
    records.push({ r, g, b });
  }

  const hasEmpty = (flags & FLAG_HAS_EMPTY) !== 0;
  const symbolCount = colorCount + (hasEmpty ? 1 : 0);
  if (symbolCount < 1) {
    throw new BoardCodecError('invalid-data', 'Empty color alphabet.');
  }

  const payloadLength = reader.readVarUint();
  const payload = reader.readBytes(payloadLength);
  if (reader.remaining !== 0) {
    throw new BoardCodecError('invalid-data', 'Unexpected trailing bytes.');
  }

  const cellCount = width * height;
  const symbols = await decodeSymbols(
    codec,
    payload,
    symbolCount,
    cellCount
  );
  const symbolBase = hasEmpty ? 1 : 0;
  const cells = new Array<number>(cellCount);

  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index];
    if (symbol === 0 && hasEmpty) {
      cells[index] = 0;
      continue;
    }
    const colorIndex = symbol - symbolBase;
    if (colorIndex < 0 || colorIndex >= colorCount) {
      throw new BoardCodecError('invalid-data', 'Invalid decoded color.');
    }
    cells[index] = colorIndex + 1;
  }

  let palette: BeadPalette;
  if (records.length === 0) {
    palette = createStarterPalette();
  } else {
    const paletteId = crypto.randomUUID();
    palette = {
      id: paletteId,
      name: paletteName || DEFAULT_PALETTE_NAME,
      colors: records.map((record, index) => {
        const code = String(index + 1).padStart(
          PALETTE_CODE_PAD_LENGTH,
          '0'
        );
        return {
          id: `${paletteId}-${index + 1}`,
          name: `${DEFAULT_PALETTE_COLOR_PREFIX}${code}`,
          hex: rgbToHex(record),
          code
        };
      })
    };
  }

  return {
    name: name || DEFAULT_PROJECT_NAME,
    width,
    height,
    beadShape,
    cells,
    palette
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined =
      (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    result += BASE64_ALPHABET[(combined >>> 18) & 0x3f];
    result += BASE64_ALPHABET[(combined >>> 12) & 0x3f];
    result +=
      index + 1 < bytes.length
        ? BASE64_ALPHABET[(combined >>> 6) & 0x3f]
        : '=';
    result +=
      index + 2 < bytes.length
        ? BASE64_ALPHABET[combined & 0x3f]
        : '=';
  }
  return result;
}

export function base64ToBytes(value: string): Uint8Array {
  const compact = value.replace(/\s+/g, '');
  if (compact.length > Math.ceil(MAX_TRANSFER_BYTES / 3) * 4 + 4) {
    throw new BoardCodecError('invalid-base64', 'Base64 data is too large.');
  }

  const unpadded = compact.replace(/=+$/, '');
  if (
    unpadded.length % 4 === 1 ||
    (compact.includes('=') && !/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact))
  ) {
    throw new BoardCodecError('invalid-base64', 'Invalid base64 padding.');
  }

  const output: number[] = [];
  let accumulator = 0;
  let bitCount = 0;
  for (const character of unpadded) {
    const normalized = character === '-' ? '+' : character === '_' ? '/' : character;
    const valueIndex = BASE64_ALPHABET.indexOf(normalized);
    if (valueIndex < 0) {
      throw new BoardCodecError('invalid-base64', 'Invalid base64 character.');
    }
    accumulator = (accumulator << 6) | valueIndex;
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      output.push((accumulator >>> bitCount) & 0xff);
      accumulator &= (1 << bitCount) - 1;
    }
    if (output.length > MAX_TRANSFER_BYTES) {
      throw new BoardCodecError('invalid-base64', 'Base64 data is too large.');
    }
  }

  if (bitCount > 0 && accumulator !== 0) {
    throw new BoardCodecError('invalid-base64', 'Invalid base64 padding bits.');
  }
  return Uint8Array.from(output);
}

export async function encodeBoardBase64(
  data: BoardTransferData
): Promise<string> {
  return bytesToBase64(await encodeBoardData(data));
}

export async function decodeBoardBase64(
  value: string
): Promise<BoardTransferData> {
  return decodeBoardData(base64ToBytes(value));
}

export async function encodeShareCode(
  data: BoardTransferData
): Promise<string> {
  return `${data.name}=${await encodeBoardBase64(data)}`;
}

export function extractShareCodeBase64(value: string): string {
  const shareCode = value.trim();
  if (!shareCode) {
    throw new BoardCodecError('invalid-base64', 'Share code is empty.');
  }

  let contentEnd = shareCode.length;
  while (contentEnd > 0 && shareCode[contentEnd - 1] === '=') {
    contentEnd -= 1;
  }
  const padding = shareCode.slice(contentEnd);

  let separatorIndex = contentEnd - 1;
  while (separatorIndex >= 0 && shareCode[separatorIndex] !== '=') {
    separatorIndex -= 1;
  }
  if (separatorIndex < 0) {
    return shareCode;
  }

  const encoded = shareCode.slice(separatorIndex + 1, contentEnd);
  if (!encoded) {
    throw new BoardCodecError('invalid-base64', 'Share code has no Base64 data.');
  }
  return `${encoded}${padding}`;
}

export async function decodeShareCode(
  value: string
): Promise<BoardTransferData> {
  return decodeBoardBase64(extractShareCodeBase64(value));
}
