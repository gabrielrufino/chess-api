import { HttpException, HttpStatus } from '@nestjs/common';

export class GameAgainstYourselfException extends HttpException {
  constructor() {
    super("You can't play against yourself", HttpStatus.PRECONDITION_FAILED);
  }
}
