import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import * as path from 'path';

dotenv.config();

async function startPythonAgent() {
  console.log('🐍 Starting Python agent...');

  const agentPath = path.join(__dirname, '../../agent.py');
  const pythonProcess = spawn('python', [agentPath, 'start'], {
    cwd: path.join(__dirname, '../..'),
    stdio: 'inherit',
  });

  pythonProcess.on('error', (error) => {
    console.error('❌ Failed to start Python agent:', error);
  });

  pythonProcess.on('close', (code) => {
    console.log(`🐍 Python agent exited with code ${code}`);
  });
}

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

  startPythonAgent().catch(console.error);
}

bootstrap();
