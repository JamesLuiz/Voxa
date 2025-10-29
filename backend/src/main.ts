import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
// Python agent is run independently; do not spawn it from NestJS.

dotenv.config();

// The Python agent is intentionally not started by NestJS. Run it independently.

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 NestJS server running on http://localhost:${port}`);
}

bootstrap();
