import { describe, it, expect } from 'vitest';
describe('base', () => {
  it('shows BASE_URL', () => {
    console.log('BASE_URL=', import.meta.env.BASE_URL);
    expect(true).toBe(true);
  });
});
