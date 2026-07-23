import { describe, it, expect } from 'vitest';
import { parseApiError, formatErrorMessage, isValidationError } from '../../src/utils/errorHandler';

function response(status: number, statusText: string): Response {
  return { status, statusText } as Response;
}

describe('parseApiError', () => {
  it('parses an array of validation errors', () => {
    const errorData = [
      { propertyName: 'netAmount', errorMessage: 'must be positive' },
      { propertyName: 'dueDate', errorMessage: 'is required' }
    ];

    const result = parseApiError(response(400, 'Bad Request'), errorData);

    expect(result).toEqual({
      message: 'Validation failed',
      details: ['netAmount: must be positive', 'dueDate: is required'],
      type: 'validation'
    });
  });

  it('parses a problem-details (RFC 7807) response and strips the "$." prefix from field names', () => {
    const errorData = {
      type: 'https://example.com/validation',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: {
        '$.netAmount': ['must be positive'],
        'dueDate': ['is required', 'must be a valid date']
      },
      traceId: 'abc123'
    };

    const result = parseApiError(response(400, 'Bad Request'), errorData);

    expect(result).toEqual({
      message: 'One or more validation errors occurred.',
      details: ['netAmount: must be positive', 'dueDate: is required', 'dueDate: must be a valid date'],
      type: 'problem-details'
    });
  });

  it('falls back to a default title when problem-details has none', () => {
    const errorData = { type: 'about:blank', errors: { field: ['bad'] } };

    const result = parseApiError(response(400, 'Bad Request'), errorData);

    expect(result.message).toBe('Validation error occurred');
    expect(result.type).toBe('problem-details');
  });

  it('parses a generic error object with a message and details', () => {
    const errorData = { message: 'Something went wrong', details: ['detail one'] };

    const result = parseApiError(response(500, 'Internal Server Error'), errorData);

    expect(result).toEqual({
      message: 'Something went wrong',
      details: ['detail one'],
      type: 'generic'
    });
  });

  it('defaults details to an empty array for a generic error without details', () => {
    const errorData = { message: 'Something went wrong' };

    const result = parseApiError(response(500, 'Internal Server Error'), errorData);

    expect(result).toEqual({
      message: 'Something went wrong',
      details: [],
      type: 'generic'
    });
  });

  it('parses a generic error object using the "error" field', () => {
    const errorData = { error: 'invalid_grant' };

    const result = parseApiError(response(401, 'Unauthorized'), errorData);

    expect(result).toEqual({
      message: 'invalid_grant',
      details: [],
      type: 'generic'
    });
  });

  it('falls back to the HTTP status when errorData is an unrecognized object', () => {
    const errorData = { unexpected: true };

    const result = parseApiError(response(503, 'Service Unavailable'), errorData);

    expect(result).toEqual({
      message: 'HTTP 503: Service Unavailable',
      details: [JSON.stringify(errorData)],
      type: 'generic'
    });
  });

  it('falls back to the HTTP status with no details when errorData is null', () => {
    const result = parseApiError(response(500, 'Internal Server Error'), null);

    expect(result).toEqual({
      message: 'HTTP 500: Internal Server Error',
      details: [],
      type: 'generic'
    });
  });
});

describe('formatErrorMessage', () => {
  it('returns just the message when there are no details', () => {
    expect(formatErrorMessage({ message: 'Oops', details: [], type: 'generic' })).toBe('Oops');
  });

  it('appends a single detail inline', () => {
    expect(formatErrorMessage({ message: 'Oops', details: ['one thing'], type: 'generic' })).toBe('Oops: one thing');
  });

  it('lists multiple details as a bulleted block', () => {
    const result = formatErrorMessage({ message: 'Oops', details: ['first', 'second'], type: 'validation' });

    expect(result).toBe('Oops:\n• first\n• second');
  });
});

describe('isValidationError', () => {
  it('returns true for validation errors', () => {
    expect(isValidationError({ message: '', details: [], type: 'validation' })).toBe(true);
  });

  it('returns true for problem-details errors', () => {
    expect(isValidationError({ message: '', details: [], type: 'problem-details' })).toBe(true);
  });

  it('returns false for generic errors', () => {
    expect(isValidationError({ message: '', details: [], type: 'generic' })).toBe(false);
  });
});
