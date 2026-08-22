import { describe, it, expect } from 'vitest';
import { calculateConstructivenessMultiplier } from './constructiveness_score';

describe('Constructiveness Score Multiplier', () => {
  it('calculates score boosts accurately', () => {
    expect(calculateConstructivenessMultiplier(0, 0)).toBe(1.0);
    expect(calculateConstructivenessMultiplier(3, 1)).toBe(1.5);
  });
});
