import { describe, it, expect } from 'vitest';
import { rirToRpe, rpeToRir, toRir, clampRir, clampRpe } from './effort';

describe('RIR/RPE conversion (approximate)', () => {
  it('maps the reference table (RIR 2 ≈ RPE 8, etc.)', () => {
    expect(rirToRpe(4)).toBe(6);
    expect(rirToRpe(3)).toBe(7);
    expect(rirToRpe(2)).toBe(8);
    expect(rirToRpe(1)).toBe(9);
    expect(rirToRpe(0)).toBe(10);
  });

  it('is the inverse in the other direction', () => {
    expect(rpeToRir(8)).toBe(2);
    expect(rpeToRir(10)).toBe(0);
  });

  it('clamps out-of-range values', () => {
    expect(clampRir(9)).toBe(5);
    expect(clampRir(-2)).toBe(0);
    expect(clampRpe(2)).toBe(5);
    expect(clampRpe(12)).toBe(10);
  });

  it('flags a conversion as approximate but a native RIR as exact', () => {
    expect(toRir(2, 'rir')).toEqual({ rir: 2, approximate: false });
    expect(toRir(8, 'rpe')).toEqual({ rir: 2, approximate: true });
    expect(toRir(null, 'rir')).toBeNull();
  });
});
