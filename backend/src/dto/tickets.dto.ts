import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ required: false, description: 'Business id (preferred) or provide businessSlug to resolve' }) businessId?: string;
  @ApiProperty({ required: false, description: 'Fallback business slug if businessId is not available' }) businessSlug?: string;
  @ApiProperty({ required: false, description: 'Customer name to create/upsert when customerId not provided' }) customerName?: string;
  @ApiProperty({ required: false, description: 'Customer phone' }) customerPhone?: string;
  @ApiProperty({ required: false }) title?: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty({ required: false, enum: ['low','medium','high','urgent'], default: 'low' }) priority?: 'low'|'medium'|'high'|'urgent';
  @ApiProperty({ required: false, description: 'Email of the user creating the ticket (used to detect owner or existing customer)' }) userEmail?: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: ['open','in-progress','resolved','closed'] }) status!: 'open' | 'in-progress' | 'resolved' | 'closed';
}

export class AssignTicketDto {
  @ApiProperty() assignedTo!: string;
}

export class AddNoteDto {
  @ApiProperty() note!: string;
}
