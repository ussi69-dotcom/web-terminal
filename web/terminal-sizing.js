const DEFAULT_TERMINAL_COLS = 120;
const DEFAULT_TERMINAL_ROWS = 30;

function predictInitialTilePixels({
  containerWidth = 0,
  containerHeight = 0,
  split = false,
  activeTileWidth = 0,
  activeTileHeight = 0,
} = {}) {
  const safeContainerWidth = Math.max(0, Number(containerWidth) || 0);
  const safeContainerHeight = Math.max(0, Number(containerHeight) || 0);
  const safeActiveWidth = Math.max(0, Number(activeTileWidth) || 0);
  const safeActiveHeight = Math.max(0, Number(activeTileHeight) || 0);

  if (!split || safeActiveWidth <= 0 || safeActiveHeight <= 0) {
    return {
      width: safeContainerWidth,
      height: safeContainerHeight,
    };
  }

  if (safeActiveWidth >= safeActiveHeight) {
    return {
      width: Math.floor(safeActiveWidth / 2),
      height: safeActiveHeight,
    };
  }

  return {
    width: safeActiveWidth,
    height: Math.floor(safeActiveHeight / 2),
  };
}

function estimateTerminalGrid({
  width = 0,
  height = 0,
  cellWidth = 0,
  cellHeight = 0,
  horizontalPadding = 16,
  verticalPadding = 16,
  fallbackCols = DEFAULT_TERMINAL_COLS,
  fallbackRows = DEFAULT_TERMINAL_ROWS,
  minCols = 20,
  minRows = 8,
} = {}) {
  const safeCellWidth = Number(cellWidth);
  const safeCellHeight = Number(cellHeight);
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const usableWidth = Math.max(
    0,
    safeWidth - Math.max(0, Number(horizontalPadding) || 0),
  );
  const usableHeight = Math.max(
    0,
    safeHeight - Math.max(0, Number(verticalPadding) || 0),
  );

  if (
    !Number.isFinite(safeCellWidth) ||
    !Number.isFinite(safeCellHeight) ||
    safeCellWidth <= 0 ||
    safeCellHeight <= 0 ||
    usableWidth <= 0 ||
    usableHeight <= 0
  ) {
    return { cols: fallbackCols, rows: fallbackRows };
  }

  const cols = Math.max(minCols, Math.floor(usableWidth / safeCellWidth));
  const rows = Math.max(minRows, Math.floor(usableHeight / safeCellHeight));

  return { cols, rows };
}

function normalizeTerminalGrid({
  cols = DEFAULT_TERMINAL_COLS,
  rows = DEFAULT_TERMINAL_ROWS,
  minCols = 20,
  minRows = 8,
  maxCols = Number.POSITIVE_INFINITY,
  maxRows = Number.POSITIVE_INFINITY,
} = {}) {
  const safeCols = Math.max(1, Number(cols) || DEFAULT_TERMINAL_COLS);
  const safeRows = Math.max(1, Number(rows) || DEFAULT_TERMINAL_ROWS);
  const safeMinCols = Math.max(1, Number(minCols) || 1);
  const safeMinRows = Math.max(1, Number(minRows) || 1);
  const safeMaxCols = Number.isFinite(Number(maxCols))
    ? Math.max(safeMinCols, Number(maxCols))
    : Number.POSITIVE_INFINITY;
  const safeMaxRows = Number.isFinite(Number(maxRows))
    ? Math.max(safeMinRows, Number(maxRows))
    : Number.POSITIVE_INFINITY;

  return {
    cols: Math.max(safeMinCols, Math.min(safeMaxCols, safeCols)),
    rows: Math.max(safeMinRows, Math.min(safeMaxRows, safeRows)),
  };
}

const TerminalSizing = {
  DEFAULT_TERMINAL_COLS,
  DEFAULT_TERMINAL_ROWS,
  predictInitialTilePixels,
  estimateTerminalGrid,
  normalizeTerminalGrid,
};

if (typeof window !== "undefined") {
  window.TerminalSizing = TerminalSizing;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = TerminalSizing;
}

if (typeof exports !== "undefined") {
  exports.DEFAULT_TERMINAL_COLS = DEFAULT_TERMINAL_COLS;
  exports.DEFAULT_TERMINAL_ROWS = DEFAULT_TERMINAL_ROWS;
  exports.predictInitialTilePixels = predictInitialTilePixels;
  exports.estimateTerminalGrid = estimateTerminalGrid;
  exports.normalizeTerminalGrid = normalizeTerminalGrid;
}
