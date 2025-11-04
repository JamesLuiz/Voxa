import { ApiProperty } from '@nestjs/swagger';

export class OwnerDto {
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() password: string;
}

export class BusinessDto {
  @ApiProperty() name: string;
  @ApiProperty() industry: string;
  @ApiProperty() phone: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) website?: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty({ required: false, type: [String] }) products?: string[];
  @ApiProperty({ required: false }) policies?: string;
}

export class RegisterDto {
  @ApiProperty({ type: OwnerDto }) owner: OwnerDto;
  @ApiProperty({ type: BusinessDto }) business: BusinessDto;
}

export class LoginDto {
  @ApiProperty() email: string;
  @ApiProperty() password: string;
}
