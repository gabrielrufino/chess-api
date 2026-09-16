import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new BadRequestException('Invalid MongoDB ObjectId');
    }
    return value;
  }
}
