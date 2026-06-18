import { ApiProperty } from '@nestjs/swagger';

export class GuestUserDto {
  @ApiProperty({ description: 'The unique identifier of the guest user' })
  id: string;

  @ApiProperty({ description: 'The name of the guest user' })
  name: string;

  @ApiProperty({ description: 'The authentication token for the guest user' })
  token: string;
}
