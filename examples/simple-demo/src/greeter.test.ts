import { describe, it, expect } from 'vitest';
import { greet } from './greeter';

describe('greeter', () => {
  describe('basic functionality', () => {
    it('should create a basic English greeting', () => {
      const result = greet({ name: 'Alice' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Hello, Alice!');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should create a Chinese greeting', () => {
      const result = greet({ name: 'Bob', language: 'zh' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('你好, Bob!');
    });

    it('should create a Spanish greeting', () => {
      const result = greet({ name: 'Charlie', language: 'es' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('¡Hola, Charlie!');
    });
  });

  describe('error handling', () => {
    it('should return error for empty name', () => {
      const result = greet({ name: '' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Name is required');
    });

    it('should return error for whitespace-only name', () => {
      const result = greet({ name: '   ' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Name is required');
    });

    it('should return error for invalid language', () => {
      const result = greet({ name: 'Dave', language: 'fr' as any });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported language');
    });
  });

  describe('edge cases', () => {
    it('should trim whitespace from name', () => {
      const result = greet({ name: '   Eve   ' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Hello, Eve!');
    });

    it('should handle names with special characters', () => {
      const result = greet({ name: 'Mary-Ann O\'Connor' });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Hello, Mary-Ann O\'Connor!');
    });
  });
});
