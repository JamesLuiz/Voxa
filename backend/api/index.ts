import { NestFactory } from '@nestjs/core';
import serverless from 'serverless-http';
import 'dotenv/config';

type AnyHandler = (req: any, res: any) => Promise<any>;

let cachedHandler: AnyHandler | null = null;

export default async function handler(req: any, res: any) {
  if (!cachedHandler) {
  // Load compiled AppModule from local backend dist using dynamic import
  const mod = await import('../dist/app.module');
  const { AppModule } = mod as any;
    const app = await NestFactory.create(AppModule);
    app.enableCors({
      origin: '*',
      methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
      allowedHeaders: ['Content-Type','Authorization','Accept','Origin','X-Requested-With'],
      credentials: true,
    });
    await app.init();
    const express = app.getHttpAdapter().getInstance();
    cachedHandler = serverless(express) as AnyHandler;
  }
  return cachedHandler(req, res);
}


