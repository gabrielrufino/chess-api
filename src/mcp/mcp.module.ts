import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameModule } from '../game/game.module';
import { PlayerModule } from '../player/player.module';
import { GameMcpProvider } from './mcp.provider';
import { GameMcpService } from './mcp.service';
import { McpGatewayController } from './mcp.controller';

/**
 * MCP Module — exposes the Model Context Protocol for AI agents to play chess.
 * Routes: GET  /mcp         → SSE stream (agent connection)
 *         POST /mcp/message → JSON-RPC messages (tool calls, resource reads)
 */
@Module({})
export class McpModule {
  static register(): DynamicModule {
    return {
      global: true,
      module: McpModule,
      imports: [GameModule, PlayerModule, JwtModule],
      providers: [GameMcpProvider, GameMcpService],
      controllers: [McpGatewayController],
      exports: [GameMcpProvider, GameMcpService],
    };
  }
}
