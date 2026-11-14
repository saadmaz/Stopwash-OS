import { matches, shortcutLabel } from './hotkeys';

const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('matches', () => {
  it('treats mod as Ctrl off Mac', () => {
    expect(matches('mod+k', ev({ key: 'k', code: 'KeyK', ctrlKey: true }))).toBe(true);
    expect(matches('mod+k', ev({ key: 'k', code: 'KeyK' }))).toBe(false);
  });

  it('uses the physical key for alt combos (Mac alters e.key)', () => {
    expect(matches('alt+n', ev({ key: '˜', code: 'KeyN', altKey: true }))).toBe(true);
    expect(matches('alt+n', ev({ key: 'n', code: 'KeyN' }))).toBe(false);
  });

  it('matches plain keys only without modifiers', () => {
    expect(matches('/', ev({ key: '/', code: 'Slash' }))).toBe(true);
    expect(matches('/', ev({ key: '/', code: 'Slash', ctrlKey: true }))).toBe(false);
  });

  it('labels shortcuts for display', () => {
    expect(shortcutLabel('mod+k')).toBe('Ctrl K');
    expect(shortcutLabel('alt+n')).toBe('Alt N');
  });
});
