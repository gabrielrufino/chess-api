import { HttpStatus } from '@nestjs/common';
import { PlayerNotFoundException } from './player-not-found.exception';

describe(PlayerNotFoundException.name, () => {
  it('should be defined', () => {
    const exception = new PlayerNotFoundException();
    expect(exception).toBeDefined();
  });

  it('should have the correct message', () => {
    const exception = new PlayerNotFoundException();
    expect(exception.message).toBe('Player not found');
  });

  it('should have HTTP status NOT_FOUND (404)', () => {
    const exception = new PlayerNotFoundException();
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });
});
