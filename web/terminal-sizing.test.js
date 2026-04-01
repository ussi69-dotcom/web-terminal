import { expect, test } from "bun:test";
import {
  estimateTerminalGrid,
  normalizeTerminalGrid,
  predictInitialTilePixels,
} from "./terminal-sizing";

test("predictInitialTilePixels uses full container size for a fresh workspace", () => {
  expect(
    predictInitialTilePixels({
      containerWidth: 1440,
      containerHeight: 900,
      split: false,
    }),
  ).toEqual({ width: 1440, height: 900 });
});

test("predictInitialTilePixels halves width when splitting a wide tile", () => {
  expect(
    predictInitialTilePixels({
      containerWidth: 1440,
      containerHeight: 900,
      split: true,
      activeTileWidth: 1000,
      activeTileHeight: 500,
    }),
  ).toEqual({ width: 500, height: 500 });
});

test("predictInitialTilePixels halves height when splitting a tall tile", () => {
  expect(
    predictInitialTilePixels({
      containerWidth: 1440,
      containerHeight: 900,
      split: true,
      activeTileWidth: 500,
      activeTileHeight: 1000,
    }),
  ).toEqual({ width: 500, height: 500 });
});

test("estimateTerminalGrid converts pixel bounds into terminal columns and rows", () => {
  expect(
    estimateTerminalGrid({
      width: 1400,
      height: 850,
      cellWidth: 8.4,
      cellHeight: 21,
      horizontalPadding: 16,
      verticalPadding: 16,
      fallbackCols: 120,
      fallbackRows: 30,
    }),
  ).toEqual({ cols: 164, rows: 39 });
});

test("estimateTerminalGrid falls back when font metrics are unavailable", () => {
  expect(
    estimateTerminalGrid({
      width: 0,
      height: 0,
      cellWidth: 0,
      cellHeight: 0,
      fallbackCols: 120,
      fallbackRows: 30,
    }),
  ).toEqual({ cols: 120, rows: 30 });
});

test("normalizeTerminalGrid caps oversized desktop terminals", () => {
  expect(
    normalizeTerminalGrid({
      cols: 311,
      rows: 66,
      maxCols: 240,
      maxRows: 60,
    }),
  ).toEqual({ cols: 240, rows: 60 });
});

test("normalizeTerminalGrid preserves smaller mobile terminal sizes", () => {
  expect(
    normalizeTerminalGrid({
      cols: 44,
      rows: 36,
      maxCols: 240,
      maxRows: 60,
    }),
  ).toEqual({ cols: 44, rows: 36 });
});
