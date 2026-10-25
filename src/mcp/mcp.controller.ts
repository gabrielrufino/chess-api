import {
  OnModuleDestroy,
  Controller,
  Post,
  Get,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { GameMcpProvider } from './mcp.provider';

/** Maximum age of an idle MCP session (5 minutes) */
const SESSION_TTL_MS = 5 * 60 * 1000;

interface SessionState {
  transport: NodeStreamableHTTPServerTransport;
  server: McpServer | null;
  sessionId: string;
  _token?: string;
  createdAt: number;
}

/** Permissive schema — validation happens in the service layer. */
const PERMISSIVE_INPUT_SCHEMA = z.object({}).passthrough();

@Controller()
export class McpGatewayController implements OnModuleDestroy {
  private readonly logger = new Logger(McpGatewayController.name);
  private sessions: Map<string, SessionState> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly mcpProvider: GameMcpProvider) {
    // Periodically evict expired sessions to prevent memory leaks
    this.cleanupTimer = setInterval(() => {
      this.evictExpiredSessions().catch(() => {});
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  private async evictExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt >= SESSION_TTL_MS) {
        this.sessions.delete(id);
        await session.transport.close().catch(() => {});
        if (session.server) {
          await session.server.close().catch(() => {});
        }
        this.logger.debug(`Evicted expired MCP session (id=${id})`);
      }
    }
  }

  @Get('mcp')
  async handleSse(@Res() res: Response, @Req() req: Request) {
    const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionIdHeader
      ? this.sessions.get(sessionIdHeader)
      : undefined;

    if (session) {
      await session.transport.handleRequest(req, res);
      return;
    }

    res.status(400).send('Missing or invalid session ID');
  }

  @Post('mcp')
  async handleMessage(@Req() req: Request, @Res() res: Response) {
    const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionIdHeader
      ? this.sessions.get(sessionIdHeader)
      : undefined;

    if (session) {
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // Check if it's an initialization request
    const body = req.body as Record<string, unknown>;
    const isInit =
      body && typeof body === 'object' && body.method === 'initialize';
    if (!isInit) {
      res.status(400).json({ error: 'Session ID required or invalid session' });
      return;
    }

    const sessionId = randomUUID();
    const authToken = this.extractAuthHeader(req);

    let server: McpServer | null = null;

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => {
        this.sessions.set(id, {
          transport,
          server,
          sessionId: id,
          _token: authToken,
          createdAt: Date.now(),
        });
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        this.sessions.delete(sid);
        this.logger.log(`MCP disconnected (session=${sid})`);
      }
    };

    try {
      server = new McpServer({ name: 'chess-mcp', version: '1.0.0' });

      // Register all tools with context access
      for (const tool of this.mcpProvider.getTools()) {
        const provider = this.mcpProvider;
        const fn = async (
          _args: z.infer<typeof PERMISSIVE_INPUT_SCHEMA>,
        ): Promise<CallToolResult> => {
          const args = { ..._args } as Record<string, unknown>;
          if (!args.accessToken && !args.token && !args.authorization) {
            const s = this.sessions.get(sessionId);
            if (s?._token) {
              args.token = s._token;
            }
          }
          const result = await provider.handleToolCall(tool.name, args);
          return {
            content: result.content.map((c) => ({
              type: 'text' as const,
              text: c.text,
            })),
            ...(result.isError && { isError: true }),
          };
        };
        server.registerTool(
          tool.name,
          {
            title: tool.name,
            description: tool.description,
            inputSchema: PERMISSIVE_INPUT_SCHEMA,
            annotations: { readOnlyHint: true },
          },
          fn,
        );
      }

      await server.connect(transport);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `MCP connection failed (session=${sessionId}): ${message}`,
      );
      await transport.close().catch(() => {});
      res.status(500).json({ error: 'Failed to initialize MCP session' });
      return;
    }

    this.logger.log(`MCP connected (session=${sessionId})`);

    await transport.handleRequest(req, res, req.body);
  }

  private extractAuthHeader(req: Request): string | undefined {
    const auth = req.headers.authorization;
    if (!auth) return undefined;
    const parts = auth.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
    return undefined;
  }
}
