import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class GuestUserDto {
  @Expose()
  @ApiProperty({ description: 'The unique identifier of the guest user' })
  id: string;

  @Expose()
  @ApiProperty({ description: 'The name of the guest user' })
  name: string;

  @Expose()
  @ApiProperty({ description: 'The authentication token for the guest user' })
  token: string;
}
