import { ApiProperty } from '@nestjs/swagger';

export class GeneralRegisterDto {
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() location: string;
}

export class GeneralLoginDto {
  @ApiProperty() email: string;
}


