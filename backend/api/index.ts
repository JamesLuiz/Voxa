import { NestFactory } from '@nestjs/core';
import serverless from 'serverless-http';
import 'dotenv/config';

type AnyHandler = (req: any, res: any) => Promise<any>;

let cachedHandler: AnyHandler | null = null;

export default async function handler(req: any, res: any) {
  if (!cachedHandler) {
    // Load compiled AppModule from local backend dist
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('../dist/app.module');
    const app = await NestFactory.create(AppModule);
    app.enableCors({ origin: '*', methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', credentials: true });
    await app.init();
    const express = app.getHttpAdapter().getInstance();
    cachedHandler = serverless(express) as AnyHandler;
  }
  return cachedHandler(req, res);
}


