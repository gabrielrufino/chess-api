import { HttpStatus } from '@nestjs/common';
import { GameAgainstYourselfException } from './game-against-yourself.exception';

describe(GameAgainstYourselfException.name, () => {
  it('should be defined', () => {
    const exception = new GameAgainstYourselfException();
    expect(exception).toBeDefined();
  });

  it('should have the correct message', () => {
    const exception = new GameAgainstYourselfException();
    expect(exception.message).toBe("You can't play against yourself");
  });

  it('should have HTTP status PRECONDITION_FAILED (412)', () => {
    const exception = new GameAgainstYourselfException();
    expect(exception.getStatus()).toBe(HttpStatus.PRECONDITION_FAILED);
  });
});
