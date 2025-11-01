// Ensure environment variables are loaded before importing application modules.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// Python agent is run independently; do not spawn it from NestJS.

// The Python agent is intentionally not started by NestJS. Run it independently.

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:8080'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 NestJS server running on http://localhost:${port}`);
}

bootstrap();
