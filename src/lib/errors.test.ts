import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('returns generic message for null/undefined', () => {
    expect(getErrorMessage(null)).toBe('Error desconocido');
    expect(getErrorMessage(undefined)).toBe('Error desconocido');
  });

  it('returns Error.message for Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns string when given a string', () => {
    expect(getErrorMessage('plain message')).toBe('plain message');
  });

  it('maps Postgres unique violation 23505', () => {
    expect(getErrorMessage({ code: '23505', message: 'duplicate key' })).toBe(
      'Ya existe un registro con esos datos.',
    );
  });

  it('maps Postgres FK violation 23503', () => {
    expect(getErrorMessage({ code: '23503', message: 'fk violation' })).toBe(
      'No se puede completar: hay registros relacionados.',
    );
  });

  it('passes through Postgres check constraint 23514 message', () => {
    expect(getErrorMessage({ code: '23514', message: 'amount must be > 0' })).toBe(
      'amount must be > 0',
    );
  });

  it('maps PostgREST RLS error PGRST301', () => {
    expect(getErrorMessage({ code: 'PGRST301', message: 'rls' })).toBe(
      'Sin permiso para esta operación.',
    );
  });

  it('returns message field for unmapped Supabase-like errors', () => {
    expect(getErrorMessage({ message: 'something else', code: '99999' })).toBe('something else');
  });

  it('falls back to details when message is missing', () => {
    expect(getErrorMessage({ details: 'detalles' })).toBe('detalles');
  });

  it('falls back to hint when message and details are missing', () => {
    expect(getErrorMessage({ hint: 'pista' })).toBe('pista');
  });

  it('returns generic for objects with nothing useful', () => {
    expect(getErrorMessage({})).toBe('Error inesperado');
  });

  it('ignores empty message and tries fallbacks', () => {
    expect(getErrorMessage({ message: '', details: 'x' })).toBe('x');
  });
});
