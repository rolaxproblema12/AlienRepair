import { describe, it, expect } from 'vitest';
import { currency } from './format';

describe('currency', () => {
  it('formats positive number as MXN', () => {
    expect(currency(1234.5)).toMatch(/\$1,234\.50/);
  });

  it('formats zero', () => {
    expect(currency(0)).toMatch(/\$0\.00/);
  });

  it('coerces numeric strings', () => {
    expect(currency('99.9')).toMatch(/\$99\.90/);
  });

  it('treats null as 0', () => {
    expect(currency(null)).toMatch(/\$0\.00/);
  });

  it('treats undefined as 0', () => {
    expect(currency(undefined)).toMatch(/\$0\.00/);
  });

  it('falls back to 0 on NaN', () => {
    expect(currency(Number.NaN)).toMatch(/\$0\.00/);
  });

  it('formats negative numbers', () => {
    expect(currency(-50)).toMatch(/-\$50\.00/);
  });
});
