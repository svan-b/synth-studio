// Elektron sequencer UI kit - render these from `custom` layout elements
// (see docs/ELEKTRON_SEQUENCER.md). Every component takes the element's
// CustomRenderContext as `ctx` and works with mouse and touch.
export { default as TrigKeys, type TrigKeysProps, type TrigKeysMode } from './TrigKeys';
export { default as TrigEditor, type TrigEditorProps } from './TrigEditor';
export { default as PagePicker, type PagePickerProps } from './PagePicker';
export { default as PatternPicker, type PatternPickerProps } from './PatternPicker';
export { default as ChainBuilder, type ChainBuilderProps } from './ChainBuilder';
export { default as SongEditor, type SongEditorProps } from './SongEditor';
export { default as ScaleMenu, type ScaleMenuProps } from './ScaleMenu';
export { default as TransportKeys, pressPlay, pressStop, type TransportKeysProps } from './TransportKeys';
export {
  C as SEQ_COLORS, UI as SEQ_UI, MenuKey, PatternGrid, SeqButton, Stepper, TrigModeKey, closeMenu, menuOpen, projectOf,
  seqStateOf, trigModeOf, viewPattern, type SeqMenu, type TrigEditorTarget, type OverlayProps,
} from './shared';
