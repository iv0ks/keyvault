import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller.js';
import { HealthController } from './health.controller.js';
import { SecretsModule } from './secrets/secrets.module.js';

@Module({
  imports: [SecretsModule],
  controllers: [HealthController, AuthController],
})
export class AppModule {}
