import { escapeRegExp } from './escape-regexp.util';

describe('escapeRegExp', () => {
  it('should return an empty string when given an empty string', () => {
    expect(escapeRegExp('')).toBe('');
  });

  it('should not modify strings without regex special characters', () => {
    expect(escapeRegExp('helloworld')).toBe('helloworld');
  });

  it('should escape dot and asterisk', () => {
    expect(escapeRegExp('hello.world*')).toBe('hello\\.world\\*');
  });

  it('should escape all regex special characters', () => {
    expect(escapeRegExp('.')).toBe('\\.');
    expect(escapeRegExp('*')).toBe('\\*');
    expect(escapeRegExp('+')).toBe('\\+');
    expect(escapeRegExp('?')).toBe('\\?');
    expect(escapeRegExp('^')).toBe('\\^');
    expect(escapeRegExp('$')).toBe('\\$');
    expect(escapeRegExp('{')).toBe('\\{');
    expect(escapeRegExp('}')).toBe('\\}');
    expect(escapeRegExp('(')).toBe('\\(');
    expect(escapeRegExp(')')).toBe('\\)');
    expect(escapeRegExp('|')).toBe('\\|');
    expect(escapeRegExp('[')).toBe('\\[');
    expect(escapeRegExp(']')).toBe('\\]');
    expect(escapeRegExp('\\')).toBe('\\\\');
  });

  it('should escape hyphens', () => {
    expect(escapeRegExp('a-z')).toBe('a\\x2dz');
  });

  it('should produce a pattern safely usable in RegExp constructor', () => {
    const userInput = 'user.name+tag[0]';
    const escaped = escapeRegExp(userInput);
    const regex = new RegExp(escaped, 'i');
    expect(regex.test(userInput)).toBe(true);
    expect(regex.test('something-else')).toBe(false);
  });
});
