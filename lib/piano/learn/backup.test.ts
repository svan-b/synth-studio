import { describe, expect, it } from 'vitest';
import { describeBackup, readBackup } from './backup';
import { newPieceState } from './coach';
import { pieceInfo, lessonOrder, allPieces } from '../content/catalog';

const order = lessonOrder();
const piece = allPieces()[0].id;

function good() {
  return {
    app: 'middle-c',
    course: 2,
    profile: { onboarded: true, experience: 'new', minutes: 20, startedOn: '2026-03-01' },
    settings: { theme: 'auto', latencyMs: 40 },
    lessons: { [order[0]]: { done: true, doneOn: '2026-03-01', step: 0 }, [order[1]]: { done: false, step: 4 } },
    pieces: { [piece]: newPieceState(pieceInfo(piece), '2026-03-01') },
    cards: {},
    days: { '2026-03-01': { seconds: 900, notes: 200, activities: 3 } },
    drills: { ear: { level: 2, recent: [1, 0, 1], lastOn: '2026-03-01' } },
    recordings: {},
    sessionDoneOn: '2026-03-01',
  };
}

describe('reading a backup', () => {
  it('reads a backup saved from the app', () => {
    const b = readBackup(JSON.stringify(good()), 2);
    expect(b).not.toBeNull();
    expect(b!.course).toBe(2);
    expect(Object.keys(b!.lessons)).toEqual([order[0], order[1]]);
    expect(b!.pieces[piece].sections.length).toBe(pieceInfo(piece).sections.length);
    expect(describeBackup(b!)).toMatch(/one lesson taken, no pieces learned, one day of practice, the last on 2026-03-01/);
  });

  it('reads the browser’s own store, wrapped as state and version', () => {
    const { app: _app, course: _course, ...state } = good();
    const b = readBackup(JSON.stringify({ state, version: 1 }), 2);
    expect(b?.course).toBe(1);
    expect(b?.profile.minutes).toBe(20);
  });

  it('turns away text that is not a backup of this app, changing nothing', () => {
    expect(readBackup('not json', 2)).toBeNull();
    expect(readBackup('[]', 2)).toBeNull();
    expect(readBackup('{"profile":"x"}', 2)).toBeNull();
    expect(readBackup('{"profile":null,"settings":null}', 2)).toBeNull();
    // Something else's file that happens to have a profile.
    expect(readBackup(JSON.stringify({ profile: { name: 'Sam', email: 'x' }, theme: 'dark' }), 2)).toBeNull();
    // A profile of ours and nothing else: not a backup, and restoring it would wipe everything.
    expect(readBackup(JSON.stringify({ profile: { onboarded: true, minutes: 20 } }), 2)).toBeNull();
  });

  it('leaves out records that would break a screen, and keeps the rest', () => {
    const data = good() as Record<string, unknown>;
    data.days = { '2026-03-01': null, '2026-03-02': { seconds: 600, notes: 1, activities: 1 }, nonsense: { seconds: 5 }, '2026-03-03': { seconds: 9e9 } };
    data.pieces = { [piece]: { startedOn: '2026-03-01', lastOn: '2026-03-02', learned: true }, 'no-such-piece': {} };
    data.lessons = { [order[0]]: { done: true }, 'no-such-lesson': { done: true }, [order[2]]: 'yes' };
    data.cards = { 'read:C4': { due: 'never' }, 'read:D4': null };
    data.drills = { ear: { level: 'high' }, rhythm: { level: 3, recent: [1, 2, 'x', 0] } };
    const b = readBackup(JSON.stringify(data), 2)!;
    expect(Object.keys(b.days).sort()).toEqual(['2026-03-02', '2026-03-03']);
    expect(b.days['2026-03-03'].seconds).toBe(86400);
    // A piece without its phrases is given them afresh, and stays learned.
    expect(Object.keys(b.pieces)).toEqual([piece]);
    expect(b.pieces[piece].sections.length).toBe(pieceInfo(piece).sections.length);
    expect(b.pieces[piece].learned).toBe(true);
    expect(Object.keys(b.lessons)).toEqual([order[0]]);
    expect(b.lessons[order[0]].step).toBe(0);
    expect(b.cards).toEqual({});
    expect(b.drills).toEqual({ rhythm: { level: 3, recent: [1, 0] } });
  });

  it('knows which course a dated iPad copy without one was made under', () => {
    const { app: _app, course: _course, ...state } = good();
    // Reached arpeggios with no lesson on sharps and flats: the first course.
    const old = { ...state, lessons: { arpeggios: { done: true, step: 0 } } };
    expect(readBackup(JSON.stringify(old), 2)?.course).toBe(1);
    // With that lesson behind them: this course, so nothing is marked done that was not taken.
    const now = { ...state, lessons: { accidentals: { done: true, step: 0 }, arpeggios: { done: true, step: 0 } } };
    expect(readBackup(JSON.stringify(now), 2)?.course).toBe(2);
  });
});
