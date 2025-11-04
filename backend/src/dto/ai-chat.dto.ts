import { ApiProperty } from '@nestjs/swagger';

export class OwnerChatDto {
  @ApiProperty() message: string;
  @ApiProperty({ required: false, type: Object }) context?: Record<string, unknown>;
}

export class CustomerChatDto {
  @ApiProperty() businessId: string;
  @ApiProperty() message: string;
}
