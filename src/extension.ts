import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type InputTipState = 'CN' | 'EN' | 'Caps';

const STATE_FILES = [
  path.join(os.tmpdir(), 'abgox.InputTip.State'),
  path.join(os.tmpdir(), 'inputtip-vscode-state.txt'),
] as const;
const EXTENSION_COLOR_KEYS = [
  'editorCursor.foreground',
  'terminalCursor.foreground',
  'terminalCursor.background',
  'editorMultiCursor.primary.foreground',
  'editorMultiCursor.secondary.foreground',
  'editor.compositionBorder',
  'focusBorder',
  // 'contrastActiveBorder',
  // 'contrastBorder',
  'widget.border',
  'input.border',
  // 'inputOption.activeBorder',
  // 'listFilterWidget.outline',
  // 'listFilterWidget.noMatchesOutline',
  'list.focusBackground',
  'list.activeSelectionBackground',
  'list.inactiveFocusBackground',
  'list.focusOutline',
  'list.focusAndSelectionOutline',
  'list.inactiveFocusOutline',
] as const;

let unwatch: (() => void) | undefined;
let requestedState: InputTipState | undefined;
let appliedState: InputTipState | undefined;
let applyingColors: Promise<void> | undefined;

export function activate(context: vscode.ExtensionContext) {
  unwatch = watchInputTipState(async (state) => {
    await scheduleColorApply(state);
  });

  context.subscriptions.push({
    dispose() {
      unwatch?.();
    },
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('inputTipCursorSync.cnColor') ||
        e.affectsConfiguration('inputTipCursorSync.enColor') ||
        e.affectsConfiguration('inputTipCursorSync.capsColor')
      ) {
        void refreshFromFile();
      }
    }),
  );

  void refreshFromFile();
}

export function deactivate() {
  unwatch?.();
  unwatch = undefined;
}

function watchInputTipState(
  onChange: (state: InputTipState) => void,
): () => void {
  let lastState = '';

  const read = () => {
    void readStateFile().then((state) => {
      if (state && state !== lastState) {
        lastState = state;
        onChange(state);
      }
    });
  };

  read();
  for (const stateFile of STATE_FILES) {
    fs.watchFile(stateFile, { interval: 100 }, read);
  }

  return () => {
    for (const stateFile of STATE_FILES) {
      fs.unwatchFile(stateFile, read);
    }
  };
}

async function refreshFromFile() {
  const state = await readStateFile();
  if (state) {
    await scheduleColorApply(state);
  }
}

async function readStateFile(): Promise<InputTipState | undefined> {
  for (const stateFile of STATE_FILES) {
    try {
      const text = await fs.promises.readFile(stateFile, 'utf8');
      const state = text.trim();
      if (state === 'CN' || state === 'EN' || state === 'Caps') {
        return state;
      }
    } catch {
      // try next candidate
    }
  }
}

async function scheduleColorApply(state: InputTipState) {
  requestedState = state;

  if (applyingColors) {
    return applyingColors;
  }

  applyingColors = (async () => {
    while (requestedState && requestedState !== appliedState) {
      const nextState = requestedState;
      requestedState = undefined;
      await applyCursorColor(nextState);
      appliedState = nextState;
    }
  })();

  try {
    await applyingColors;
  } finally {
    applyingColors = undefined;

    if (requestedState && requestedState !== appliedState) {
      await scheduleColorApply(requestedState);
    }
  }
}

async function applyCursorColor(state: InputTipState) {
  const config = vscode.workspace.getConfiguration('inputTipCursorSync');

  const color =
    state === 'CN'
      ? config.get<string>('cnColor', '#ff4d4f')
      : state === 'EN'
        ? config.get<string>('enColor', '#4096ff')
        : config.get<string>('capsColor', '#52c41a');

  const workbenchConfig = vscode.workspace.getConfiguration('workbench');
  const current = workbenchConfig.get<Record<string, string>>(
    'colorCustomizations',
    {},
  );
  const next = { ...current } as Record<string, string>;
  const listBackground = withAlpha(color, '22');
  const listInactiveBackground = withAlpha(color, '16');

  for (const key of EXTENSION_COLOR_KEYS) {
    delete next[key];
  }

  next['editorCursor.foreground'] = color;
  next['terminalCursor.foreground'] = color;
  next['terminalCursor.background'] = color;
  next['editorMultiCursor.primary.foreground'] = color;
  next['editorMultiCursor.secondary.foreground'] = color;
  next['editor.compositionBorder'] = color;
  next['focusBorder'] = color;
  // next['contrastActiveBorder'] = color;
  // next['contrastBorder'] = color;
  next['widget.border'] = color;
  next['input.border'] = color;
  // next['inputOption.activeBorder'] = color;
  // next['listFilterWidget.outline'] = color;
  // next['listFilterWidget.noMatchesOutline'] = color;
  next['list.focusBackground'] = listBackground;
  next['list.activeSelectionBackground'] = listBackground;
  next['list.inactiveFocusBackground'] = listInactiveBackground;
  next['list.focusOutline'] = color;
  next['list.focusAndSelectionOutline'] = color;
  next['list.inactiveFocusOutline'] = color;

  await workbenchConfig.update(
    'colorCustomizations',
    next,
    vscode.ConfigurationTarget.Global,
  );
}

function withAlpha(color: string, alpha: string): string {
  const normalized = color.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return `${normalized}${alpha}`;
  }

  if (/^#[0-9a-fA-F]{8}$/.test(normalized)) {
    return `${normalized.slice(0, 7)}${alpha}`;
  }

  return normalized;
}
