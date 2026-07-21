import { escapeRegExp } from './escape-regexp.util';

describe('escapeRegExp', () => {
  it('should escape regular expression characters', () => {
    expect(escapeRegExp('hello.world*')).toBe('hello\\.world\\*');
    expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('should not modify strings without regex characters', () => {
    expect(escapeRegExp('helloworld')).toBe('helloworld');
  });
});
