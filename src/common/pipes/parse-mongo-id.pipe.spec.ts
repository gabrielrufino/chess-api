import { ParseMongoIdPipe } from './parse-mongo-id.pipe';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('ParseMongoIdPipe', () => {
  let pipe: ParseMongoIdPipe;

  beforeEach(() => {
    pipe = new ParseMongoIdPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should return value if it is a valid ObjectId', () => {
    const validId = new Types.ObjectId().toString();
    expect(pipe.transform(validId)).toBe(validId);
  });

  it('should throw BadRequestException if it is an invalid ObjectId', () => {
    const invalidId = 'invalid-id';
    expect(() => pipe.transform(invalidId)).toThrow(BadRequestException);
    expect(() => pipe.transform(invalidId)).toThrow('Invalid MongoDB ObjectId');
  });

  it('should throw BadRequestException for a 24-character non-hex string', () => {
    const invalidId = 'zzzzzzzzzzzzzzzzzzzzzzzz';
    expect(() => pipe.transform(invalidId)).toThrow(BadRequestException);
    expect(() => pipe.transform(invalidId)).toThrow('Invalid MongoDB ObjectId');
  });
});
