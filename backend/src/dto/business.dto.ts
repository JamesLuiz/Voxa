import { ApiProperty } from '@nestjs/swagger';

export class UpdateBusinessDto {
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty({ required: false, type: [String] }) products?: string[];
  @ApiProperty({ required: false }) policies?: string;
}

export class AgentConfigDto {
  @ApiProperty({ required: false, enum: ['professional', 'casual', 'friendly'] }) tone?: 'professional' | 'casual' | 'friendly';
  @ApiProperty({ required: false, enum: ['concise', 'detailed'] }) responseStyle?: 'concise' | 'detailed';
  @ApiProperty({ required: false, type: Object }) businessHours?: Record<string, string>;
  @ApiProperty({ required: false }) autoEscalate?: boolean;
  @ApiProperty({ required: false }) customPrompt?: string;
}
