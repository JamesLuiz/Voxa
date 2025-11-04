import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty() businessId: string;
  @ApiProperty() name: string;
  @ApiProperty() email?: string;
  @ApiProperty() phone?: string;
  @ApiProperty({ required: false }) company?: string;
  @ApiProperty({ required: false, type: [String] }) tags?: string[];
}

export class UpsertCustomerDto {
  @ApiProperty() businessId: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) phone?: string;
  @ApiProperty({ required: false }) company?: string;
}
