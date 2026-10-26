import { Injectable, ExecutionContext } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/** Skips throttling for MCP protocol endpoints */
@Injectable()
export class McpAwareThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  public override async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ExpressRequest>();
    if (typeof req.path === 'string' && req.path.startsWith('/mcp')) {
      return true;
    }
    return super.canActivate(context);
  }
}
