import { describe, expect, it } from 'vitest';
import { relationshipDays } from './relationshipDays';

describe('relationshipDays', () => {
  it('counts the start date as the first day using local calendar dates', () => {
    expect(relationshipDays('2026-08-10', new Date(2026, 7, 12, 23, 30))).toBe(3);
  });

  it('does not invent a count before a date is configured', () => {
    expect(relationshipDays('', new Date(2026, 7, 12))).toBeNull();
  });
});
