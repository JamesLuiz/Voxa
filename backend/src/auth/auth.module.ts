import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Business, BusinessSchema } from '../schemas/business.schema';
import { EmailCredentials, EmailCredentialsSchema } from '../schemas/email-credentials.schema';
import { EmailCredentialsService } from './email-credentials.service';
import { EmailCredentialsController } from './email-credentials.controller';
import { GeneralUser, GeneralUserSchema } from '../schemas/general-user.schema';
import { GeneralAuthController } from './general.controller';
import { GeneralConversationController } from './general-conversation.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Business.name, schema: BusinessSchema },
      { name: EmailCredentials.name, schema: EmailCredentialsSchema },
      { name: GeneralUser.name, schema: GeneralUserSchema },
    ])
  ],
  controllers: [AuthController, EmailCredentialsController, GeneralAuthController, GeneralConversationController],
  providers: [AuthService, EmailCredentialsService],
  exports: [EmailCredentialsService]
})
export class AuthModule {}


