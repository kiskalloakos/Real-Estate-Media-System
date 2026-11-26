import { blockTypes, newBlock, type ProductionDocument, type ScreenplayBlock, type ScreenplayBlockType } from './screenplay';

export function nextBlockType(type: ScreenplayBlockType): ScreenplayBlockType {
  return type === 'character' || type === 'parenthetical' ? 'dialogue' : type === 'dialogue' ? 'character' : 'action';
}

export function cycleBlockType(type: ScreenplayBlockType): ScreenplayBlockType {
  return blockTypes[(blockTypes.indexOf(type) + 1) % blockTypes.length];
}

export function splitBlock(block: ScreenplayBlock, start: number, end = start) {
  return [
    { ...block, text: block.text.slice(0, start) },
    newBlock(nextBlockType(block.type), block.text.slice(end)),
  ] as const;
}

export interface ProductionHistory {
  present: ProductionDocument | null;
  past: (ProductionDocument | null)[];
  future: (ProductionDocument | null)[];
  group?: string;
  changedAt: number;
}
export type ProductionEdit =
  | { type: 'change'; update: (current: ProductionDocument | null) => ProductionDocument | null; group?: string; now: number }
  | { type: 'undo' }
  | { type: 'redo' };

export function productionHistory(present: ProductionDocument | null): ProductionHistory {
  return { present, past: [], future: [], changedAt: 0 };
}

export function reduceProductionHistory(state: ProductionHistory, edit: ProductionEdit): ProductionHistory {
  if (edit.type === 'undo') {
    if (!state.past.length) return state;
    return { ...productionHistory(state.past.at(-1)!), past: state.past.slice(0, -1), future: [state.present, ...state.future] };
  }
  if (edit.type === 'redo') {
    if (!state.future.length) return state;
    return { ...productionHistory(state.future[0]), past: [...state.past, state.present], future: state.future.slice(1) };
  }
  const present = edit.update(state.present);
  if (present === state.present) return state;
  const coalesce = Boolean(edit.group && edit.group === state.group && edit.now - state.changedAt < 650);
  return { present, past: coalesce ? state.past : [...state.past, state.present].slice(-80), future: [], group: edit.group, changedAt: edit.now };
}
