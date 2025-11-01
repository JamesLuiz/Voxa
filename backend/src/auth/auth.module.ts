import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Business, BusinessSchema } from '../schemas/business.schema';
import { EmailCredentials, EmailCredentialsSchema } from '../schemas/email-credentials.schema';
import { EmailCredentialsService } from './email-credentials.service';
import { EmailCredentialsController } from './email-credentials.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Business.name, schema: BusinessSchema },
      { name: EmailCredentials.name, schema: EmailCredentialsSchema }
    ])
  ],
  controllers: [AuthController, EmailCredentialsController],
  providers: [AuthService, EmailCredentialsService],
  exports: [EmailCredentialsService]
})
export class AuthModule {}


