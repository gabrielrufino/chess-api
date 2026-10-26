import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { plainToInstance } from 'class-transformer';
import { McpGameDto, McpBoardDto } from './dto/mcp-game.dto';
import { GameMcpService, ToolResult } from './mcp.service';
import { GameDurationEnum } from '../game/enumerables/game-duration.enum';

/**
 * MCP Provider — declares every MCP Tool and Resource available to agents.
 * Implementation delegates to GameMcpService which contains all business logic.
 */
@Injectable()
export class GameMcpProvider {
  private readonly logger = new Logger(GameMcpProvider.name);

  constructor(
    private readonly mcpService: GameMcpService,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  /** Verify JWT and extract user identity */
  public async verifyJwt(
    token: string,
  ): Promise<{ sub: string; isGuest: boolean }> {
    return this.jwtService.verifyAsync(token);
  }

  /**
   * Returns all MCP tool definitions.
   */
  public getTools(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    return [
      {
        name: 'create_game',
        description:
          'Create a new chess game. If another player is waiting for the same duration, you will be automatically matched against them as Black. Otherwise you start as White.',
        inputSchema: {
          type: 'object',
          required: ['playerId', 'duration'],
          properties: {
            playerId: {
              type: 'string',
              description: 'MongoDB ObjectId of the player creating the game.',
            },
            duration: {
              type: 'string',
              enum: Object.values(GameDurationEnum),
              description:
                'Time control for the game (e.g., "5min", "3+2", "unlimited").',
            },
          },
        },
      },
      {
        name: 'list_games',
        description:
          'List recent games on the server. Use skip and limit for pagination.',
        inputSchema: {
          type: 'object',
          properties: {
            skip: {
              type: 'integer',
              description: 'Number of games to skip (default: 0).',
            },
            limit: {
              type: 'integer',
              description:
                'Maximum number of games to return (default: 10, max: 100).',
            },
          },
        },
      },
      {
        name: 'get_game',
        description: 'Get details of a specific game by its ID.',
        inputSchema: {
          type: 'object',
          required: ['gameId'],
          properties: {
            gameId: {
              type: 'string',
              description: 'MongoDB ObjectId of the game.',
            },
          },
        },
      },
      {
        name: 'get_board',
        description:
          'Get the current board state (FEN string and visual board array) for a game.',
        inputSchema: {
          type: 'object',
          required: ['gameId'],
          properties: {
            gameId: {
              type: 'string',
              description: 'MongoDB ObjectId of the game.',
            },
          },
        },
      },
      {
        name: 'make_move',
        description:
          'Make a move in an in-progress game using algebraic notation (e.g., "e4", "Nf3", "O-O").',
        inputSchema: {
          type: 'object',
          required: ['gameId', 'move', 'playerId'],
          properties: {
            gameId: {
              type: 'string',
              description: 'MongoDB ObjectId of the game.',
            },
            move: {
              type: 'string',
              description:
                'Move in standard algebraic notation (e.g., "e4", "Nf3", "Bxc6", "O-O", "Qh5#").',
            },
            playerId: {
              type: 'string',
              description: 'MongoDB ObjectId of the player making the move.',
            },
          },
        },
      },
      {
        name: 'get_available_durations',
        description:
          'List all available time controls/durations for creating games.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'claim_timeout',
        description:
          'Claim a timeout win if the opponent has run out of time. Both players must be present and the game must have a time control.',
        inputSchema: {
          type: 'object',
          required: ['gameId', 'playerId'],
          properties: {
            gameId: {
              type: 'string',
              description: 'MongoDB ObjectId of the game.',
            },
            playerId: {
              type: 'string',
              description:
                'MongoDB ObjectId of the player claiming the timeout.',
            },
          },
        },
      },
      {
        name: 'get_player_info',
        description:
          'Get information about a player by userId (the JWT subject). Includes rating, nickname, etc.',
        inputSchema: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: {
              type: 'string',
              description: 'The unique player identifier (JWT sub claim).',
            },
          },
        },
      },
    ];
  }

  /**
   * Handles MCP tool execution.
   */
  public async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const validTools = new Set(this.getTools().map((t) => t.name));
    if (!validTools.has(toolName)) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${toolName}. Available tools: ${[...validTools].join(', ')}`,
          },
        ],
      };
    }

    // Derive playerId from JWT token if provided and not already in args
    let resolvedPlayerId = (args.playerId ?? null) as string | null;
    const jwtToken = (args.token ?? args.accessToken ?? args.authorization) as
      string | undefined;
    if (jwtToken && !resolvedPlayerId) {
      try {
        const payload = await this.verifyJwt(jwtToken);
        resolvedPlayerId = payload.sub; // sub is the userId/playerId
      } catch (err) {
        this.logger.warn(
          `JWT verification failed for tool "${toolName}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (resolvedPlayerId) args.playerId = resolvedPlayerId;

    try {
      switch (toolName) {
        case 'create_game':
          return this.mcpService.handleCreateGame(args);
        case 'list_games':
          return this.mcpService.handleListGames(args);
        case 'get_game':
          return this.mcpService.handleGetGame(args);
        case 'get_board':
          return this.mcpService.handleGetBoard(args);
        case 'make_move':
          return this.mcpService.handleMakeMove(args);
        case 'get_available_durations':
          return this.mcpService.handleGetDurations();
        case 'claim_timeout':
          return this.mcpService.handleClaimTimeout(args);
        case 'get_player_info':
          return this.mcpService.handleGetPlayerInfo(args);
        default:
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Tool "${toolName}" not implemented`,
              },
            ],
          };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tool call failed: ${message}`);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error: ${message}`,
          },
        ],
      };
    }
  }

  /**
   * Returns MCP resource definitions.
   */
  public getResources(): Array<{
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
  }> {
    return [
      {
        uri: 'chess://games/{id}',
        name: 'Game State',
        description:
          'Full state of a chess game including players, FEN, PGN, status, and remaining time. Supports subscription for real-time updates.',
        mimeType: 'application/json',
      },
      {
        uri: 'chess://board/{id}',
        name: 'Board Visual',
        description:
          'Visual representation of the board state as a 2D array plus FEN string. Supports subscription for real-time updates.',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Reads a resource by URI.
   */
  public async handleReadResource(
    uri: string,
  ): Promise<{ contents: Array<{ uri: string; text: string }> }> {
    const match = /^chess:\/\/(games|board)\/(.+)$/.exec(uri);
    if (!match) {
      return {
        contents: [{ uri, text: `Resource "${uri}" not found` }],
      };
    }

    const [, kind, gameId] = match;
    if (!kind || !gameId) {
      return {
        contents: [{ uri, text: `Invalid resource URI: ${uri}` }],
      };
    }

    const game = await this.mcpService.findGame(gameId);
    if (!game) {
      return {
        contents: [
          {
            uri,
            text: JSON.stringify({ error: `Game ${gameId} not found` }),
          },
        ],
      };
    }

    const chess = this.mcpService.loadChessGame(game);

    if (kind === 'games') {
      const gameDto = plainToInstance(McpGameDto, game);
      return {
        contents: [{ uri, text: JSON.stringify(gameDto, null, 2) }],
      };
    }

    if (kind === 'board') {
      const boardDto = plainToInstance(McpBoardDto, {
        fen: chess.fen(),
        board: chess.board(),
      });
      return {
        contents: [{ uri, text: JSON.stringify(boardDto, null, 2) }],
      };
    }

    return {
      contents: [{ uri, text: `Unknown resource kind: ${kind}` }],
    };
  }
}
