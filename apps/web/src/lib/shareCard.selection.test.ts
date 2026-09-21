import { describe, expect, it } from 'vitest';
import { MAX_SHARE_LINES, toggleShareSelection } from './shareCard';

describe('toggleShareSelection', () => {
  it('starts, extends both ways, and stays sorted', () => {
    expect(toggleShareSelection([], 4)).toEqual([4]);
    expect(toggleShareSelection([4], 5)).toEqual([4, 5]);
    expect(toggleShareSelection([4, 5], 3)).toEqual([3, 4, 5]);
  });

  it('drops from either end but never splits the run', () => {
    expect(toggleShareSelection([3, 4, 5], 3)).toEqual([4, 5]);
    expect(toggleShareSelection([3, 4, 5], 5)).toEqual([3, 4]);
    expect(toggleShareSelection([3, 4, 5], 4)).toEqual([3, 4, 5]);
  });

  it('restarts on a non-adjacent line and honours the cap', () => {
    expect(toggleShareSelection([3, 4], 9)).toEqual([9]);
    const full = [0, 1, 2, 3, 4];
    expect(full).toHaveLength(MAX_SHARE_LINES);
    expect(toggleShareSelection(full, 5)).toEqual(full);
    expect(toggleShareSelection(full, 0)).toEqual([1, 2, 3, 4]);
  });
});
