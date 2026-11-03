import { describe, it, expect } from '@jest/globals';
import { readableDetail } from '../errorDetail';

describe('readableDetail', () => {
  it('leaves a plain string alone', () => {
    expect(readableDetail('User not found')).toBe('User not found');
  });

  it('turns a FastAPI validation list into text, not objects', () => {
    const detail = [
      { type: 'value_error', loc: ['body', 'phone'], msg: 'Value error, Invalid phone number', input: '123', ctx: { error: {} } },
    ];
    const text = readableDetail(detail);
    expect(typeof text).toBe('string');
    expect(text).toBe('phone: Invalid phone number');
  });

  it('joins several problems on separate lines', () => {
    const text = readableDetail([
      { type: 'missing', loc: ['body', 'first_name'], msg: 'Field required', input: {} },
      { type: 'string_too_short', loc: ['body', 'phone'], msg: 'String should have at least 10 characters', input: '1' },
    ]);
    expect(text).toBe('first name: Field required\nphone: String should have at least 10 characters');
  });

  it('handles a single object and unknown shapes without throwing', () => {
    expect(readableDetail({ msg: 'Bad thing' })).toBe('Bad thing');
    expect(typeof readableDetail({ weird: true })).toBe('string');
    expect(typeof readableDetail(null)).toBe('string');
    expect(typeof readableDetail([])).toBe('string');
  });
});
