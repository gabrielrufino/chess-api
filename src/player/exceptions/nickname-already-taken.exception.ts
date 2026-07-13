import { ConflictException } from '@nestjs/common';

export class NicknameAlreadyTakenException extends ConflictException {
  constructor(nickname: string) {
    super(`Nickname "${nickname}" is already taken`);
  }
}
