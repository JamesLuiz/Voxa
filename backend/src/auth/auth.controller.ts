import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body()
    body: {
      owner: { name: string; email: string; password: string };
      business: {
        name: string;
        industry: string;
        description?: string;
        products?: string[];
        policies?: string;
        phone: string;
        email: string;
        website?: string;
      };
    },
  ) {
    return this.authService.register(body);
  }
}


