import { HttpException, HttpStatus } from '@nestjs/common';

export class PlayerNotFoundException extends HttpException {
  constructor() {
    super('Player not found', HttpStatus.NOT_FOUND);
  }
}
