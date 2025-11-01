// Ensure environment variables are loaded before importing application modules.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:8080', 'https://voxa-smoky.vercel.app'],
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','Accept','Origin','X-Requested-With'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 NestJS server running on http://localhost:${port}`);
}

bootstrap();
