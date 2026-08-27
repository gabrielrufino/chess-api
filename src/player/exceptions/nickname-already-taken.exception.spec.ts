import { ConflictException } from '@nestjs/common';
import { NicknameAlreadyTakenException } from './nickname-already-taken.exception';

describe(NicknameAlreadyTakenException.name, () => {
  it('should be an instance of ConflictException', () => {
    const ex = new NicknameAlreadyTakenException('myNick');
    expect(ex).toBeInstanceOf(ConflictException);
  });

  it('should have the correct error message including the nickname', () => {
    const ex = new NicknameAlreadyTakenException('myNick');
    expect(ex.message).toBe('Nickname "myNick" is already taken');
  });

  it('should include the nickname in the message', () => {
    const nickname = 'CoolPlayer99';
    const ex = new NicknameAlreadyTakenException(nickname);
    expect(ex.message).toContain(nickname);
  });

  it('should produce different messages for different nicknames', () => {
    const ex1 = new NicknameAlreadyTakenException('Alice');
    const ex2 = new NicknameAlreadyTakenException('Bob');
    expect(ex1.message).not.toBe(ex2.message);
    expect(ex1.message).toContain('Alice');
    expect(ex2.message).toContain('Bob');
  });
});
