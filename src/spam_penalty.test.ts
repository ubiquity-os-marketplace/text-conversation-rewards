import { describe, it, expect } from 'vitest';
import { calculateDuplicateSpamPenalty } from './spam_penalty';

describe('UbiquityOS Spam Penalty', () => {
  it('penalizes copy-pasted comments', () => {
    expect(calculateDuplicateSpamPenalty(0.9, 100)).toBe(0);
    expect(calculateDuplicateSpamPenalty(0.7, 100)).toBe(50);
    expect(calculateDuplicateSpamPenalty(0.2, 100)).toBe(100);
  });
});
