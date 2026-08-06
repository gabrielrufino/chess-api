import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('HealthCheck')
@SkipThrottle()
@Controller()
export class AppController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  public check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }
}
