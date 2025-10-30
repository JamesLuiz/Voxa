import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import serverless from 'serverless-http';

dotenv.config();

export default async function handler(req: any, res: any) {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', credentials: true });
  await app.init();
  const express = app.getHttpAdapter().getInstance();
  const proxy = serverless(express);
  return proxy(req, res);
}


