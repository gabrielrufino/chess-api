import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser, AuthRequest } from '../interfaces/auth-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  public async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') {
      return true;
    }

    // Allow MCP protocol endpoints — authentication is handled per-tool call
    // via the session established during the initial JSON-RPC handshake.
    // The MCP transport does not send Authorization headers between calls.
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (request.path?.startsWith('/mcp')) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];
    if (type?.toLowerCase() === 'bearer') {
      return token;
    }
    return undefined;
  }
}
