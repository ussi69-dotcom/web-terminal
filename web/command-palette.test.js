import { afterEach, test, expect } from "bun:test";
import { ActionRegistry } from "./action-registry";
import { CommandPaletteController } from "./command-palette";

function createClassList() {
  const classes = new Set();
  return {
    add(...tokens) {
      tokens.forEach((token) => classes.add(token));
    },
    remove(...tokens) {
      tokens.forEach((token) => classes.delete(token));
    },
    contains(token) {
      return classes.has(token);
    },
    setFromString(value) {
      classes.clear();
      String(value || "")
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => classes.add(token));
    },
    toString() {
      return [...classes].join(" ");
    },
  };
}

function createFakeElement(tagName, ownerDocument) {
  const classList = createClassList();
  const listeners = new Map();
  const element = {
    tagName: String(tagName || "div").toUpperCase(),
    ownerDocument,
    children: [],
    dataset: {},
    style: {},
    value: "",
    textContent: "",
    type: "",
    parentNode: null,
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event.type) || [];
      handlers.forEach((handler) => handler(event));
      return true;
    },
    focus() {
      ownerDocument.activeElement = this;
    },
    querySelectorAll(selector) {
      const results = [];
      const matcher = selector.startsWith(".")
        ? (node) => node.classList.contains(selector.slice(1))
        : () => false;

      const walk = (node) => {
        if (matcher(node)) results.push(node);
        node.children.forEach(walk);
      };

      this.children.forEach(walk);
      return results;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    classList,
  };

  Object.defineProperty(element, "className", {
    get() {
      return classList.toString();
    },
    set(value) {
      classList.setFromString(value);
    },
  });

  Object.defineProperty(element, "innerHTML", {
    get() {
      return "";
    },
    set(value) {
      if (value === "") {
        this.children = [];
        this.textContent = "";
      }
    },
  });

  return element;
}

function createFakeDocument() {
  const document = {
    activeElement: null,
    createElement(tagName) {
      return createFakeElement(tagName, document);
    },
  };
  document.body = createFakeElement("body", document);
  return document;
}

function createPaletteDom() {
  const document = createFakeDocument();
  globalThis.document = document;

  const root = document.createElement("div");
  root.className = "command-palette hidden";
  document.body.appendChild(root);

  const panel = document.createElement("div");
  panel.className = "command-palette-panel";
  root.appendChild(panel);

  const header = document.createElement("div");
  header.className = "command-palette-header";
  panel.appendChild(header);

  const input = document.createElement("input");
  input.id = "command-palette-input";
  header.appendChild(input);

  const results = document.createElement("div");
  results.id = "command-palette-results";
  results.className = "command-palette-results";
  panel.appendChild(results);

  const footer = document.createElement("div");
  footer.className = "command-palette-footer";
  panel.appendChild(footer);

  return { document, root, input, results };
}

function createRegistry(runLog = []) {
  const registry = new ActionRegistry();

  registry.register({
    id: "open-git",
    title: "Open Git",
    group: "Actions",
    run: () => runLog.push("open-git"),
  });

  registry.register({
    id: "open-file-manager",
    title: "Open File Manager",
    group: "Actions",
    run: () => runLog.push("open-file-manager"),
  });

  return registry;
}

afterEach(() => {
  delete globalThis.document;
});

test("open and close update hidden state and focus the input", () => {
  const dom = createPaletteDom();
  const controller = new CommandPaletteController({
    ...dom,
    registry: createRegistry(),
  });

  controller.open();

  expect(dom.root.classList.contains("hidden")).toBeFalse();
  expect(document.activeElement).toBe(dom.input);

  controller.close();

  expect(dom.root.classList.contains("hidden")).toBeTrue();
});

test("ArrowDown changes the selected item and Enter runs it", () => {
  const runLog = [];
  const dom = createPaletteDom();
  const controller = new CommandPaletteController({
    ...dom,
    registry: createRegistry(runLog),
  });

  controller.open();

  dom.input.dispatchEvent(
    { type: "keydown", key: "ArrowDown", preventDefault() {} },
  );
  dom.input.dispatchEvent(
    { type: "keydown", key: "Enter", preventDefault() {} },
  );

  expect(runLog).toEqual(["open-file-manager"]);
  expect(dom.root.classList.contains("hidden")).toBeTrue();
});

test("Escape closes the palette from the keyboard", () => {
  const dom = createPaletteDom();
  const controller = new CommandPaletteController({
    ...dom,
    registry: createRegistry(),
  });

  controller.open();
  dom.input.dispatchEvent(
    { type: "keydown", key: "Escape", preventDefault() {} },
  );

  expect(dom.root.classList.contains("hidden")).toBeTrue();
});

test("empty query renders default results", () => {
  const dom = createPaletteDom();
  const controller = new CommandPaletteController({
    ...dom,
    registry: createRegistry(),
  });

  controller.open();

  const resultItems = Array.from(
    dom.results.querySelectorAll(".command-palette-item-title"),
  ).map((node) => node.textContent?.trim());

  expect(resultItems).toEqual(["Open Git", "Open File Manager"]);
});
