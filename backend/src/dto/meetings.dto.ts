import { ApiProperty } from '@nestjs/swagger';

export class CreateMeetingDto {
  @ApiProperty() businessId: string;
  @ApiProperty({ required: false }) customerId?: string;
  @ApiProperty() title: string;
  @ApiProperty() startTime: string;
  @ApiProperty({ required: false }) duration?: number;
  @ApiProperty({ required: false, type: [String] }) attendees?: string[];
  @ApiProperty({ required: false }) notes?: string;
}
