import { describe, it, expect } from 'vitest';
import { blurSizeChain } from './shareCard';

describe('blurSizeChain', () => {
  it('starts and ends at the requested size', () => {
    const chain = blurSizeChain(1080, 80);
    expect(chain[0]).toBe(1080);
    expect(chain[chain.length - 1]).toBe(1080);
  });

  it('uses integer canvas sizes only', () => {
    for (const [size, strength] of [[1080, 80], [1080, 48], [512, 80], [999, 33]] as const) {
      for (const n of blurSizeChain(size, strength)) expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('descends then ascends, never below 6px', () => {
    const chain = blurSizeChain(1080, 80);
    const min = Math.min(...chain);
    const at = chain.indexOf(min);
    for (let i = 1; i <= at; i++) expect(chain[i]).toBeLessThan(chain[i - 1]);
    for (let i = at + 1; i < chain.length; i++) expect(chain[i]).toBeGreaterThan(chain[i - 1]);
    expect(min).toBeGreaterThanOrEqual(6);
  });

  it('reaches the calibrated intermediate sizes at 1080', () => {
    expect(Math.min(...blurSizeChain(1080, 80))).toBe(16);
    expect(Math.min(...blurSizeChain(1080, 48))).toBe(33);
    expect(blurSizeChain(1080, 80)).toEqual([1080, 540, 270, 135, 67, 33, 16, 32, 64, 128, 256, 512, 1024, 1080]);
  });

  it('handles a canvas too small to halve', () => {
    expect(blurSizeChain(8, 80)).toEqual([8]);
    expect(blurSizeChain(20, 80)).toEqual([20, 10, 20]);
  });
});
