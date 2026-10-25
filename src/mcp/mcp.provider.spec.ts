/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import 'reflect-metadata';
import { Chess } from 'chess.js';
import { GameMcpProvider } from './mcp.provider';
import type { ToolResult } from './mcp.service';
import { GameDurationEnum } from '../game/enumerables/game-duration.enum';

describe(GameMcpProvider.name, () => {
  let mcpServiceMock: Record<string, jest.Mock>;
  let jwtServiceMock: Record<string, jest.Mock>;
  let provider: GameMcpProvider;

  beforeEach(() => {
    mcpServiceMock = {
      findGame: jest.fn(),
      loadChessGame: jest.fn().mockReturnValue(new Chess()),
      handleGetDurations: jest.fn(),
      handleListGames: jest.fn(),
      handleGetGame: jest.fn(),
      handleGetBoard: jest.fn(),
      handleCreateGame: jest.fn(),
      handleMakeMove: jest.fn(),
      handleClaimTimeout: jest.fn(),
      handleGetPlayerInfo: jest.fn(),
    };

    jwtServiceMock = {
      verifyAsync: jest.fn(),
    };

    // Bypass NestJS DI — create instance with empty args, then replace private props
    provider = new GameMcpProvider({} as never, {} as never);

    Object.defineProperty(provider, 'mcpService', {
      value: mcpServiceMock,
      writable: true,
      configurable: true,
    });
    (provider as any).jwtService = jwtServiceMock;

    // Reset all mocks
    Object.values(mcpServiceMock).forEach((val) => val.mockClear());
    jwtServiceMock.verifyAsync.mockClear();
  });

  // Helper to wrap return value as ToolResult
  const ok = (data: unknown): ToolResult => ({
    isError: false,
    content: [{ type: 'text', text: JSON.stringify(data) }],
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe(GameMcpProvider.prototype.verifyJwt.name, () => {
    it('should return verified JWT payload', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'user123',
        isGuest: false,
      });

      const result = await provider.verifyJwt('fake-token');

      expect(result).toEqual({ sub: 'user123', isGuest: false });
    });
  });

  describe(GameMcpProvider.prototype.getTools.name, () => {
    it('should return all tool definitions', () => {
      const tools = provider.getTools();
      expect(tools.length).toBe(8);
    });

    it('should include all known tool names', () => {
      const names = provider.getTools().map((t) => t.name);
      expect(names).toContain('create_game');
      expect(names).toContain('list_games');
      expect(names).toContain('get_game');
      expect(names).toContain('get_board');
      expect(names).toContain('make_move');
      expect(names).toContain('get_available_durations');
      expect(names).toContain('claim_timeout');
      expect(names).toContain('get_player_info');
    });

    it('should have required fields for each tool', () => {
      provider.getTools().forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
      });
    });

    it('should specify correct required fields per tool', () => {
      const tools = provider.getTools();
      const expectedRequired: Record<string, string[]> = {
        create_game: ['playerId', 'duration'],
        get_game: ['gameId'],
        get_board: ['gameId'],
        make_move: ['gameId', 'move', 'playerId'],
        claim_timeout: ['gameId', 'playerId'],
        get_player_info: ['userId'],
        list_games: [],
        get_available_durations: [],
      };

      for (const tool of tools) {
        const req = expectedRequired[tool.name];
        if (req && req.length > 0) {
          expect(tool.inputSchema.required).toEqual(req);
        } else {
          expect(
            tool.inputSchema.required === undefined ||
              Array.isArray(tool.inputSchema.required),
          ).toBeTruthy();
        }
      }
    });

    it('should use GameDurationEnum values for create_game duration property', () => {
      const createTool = provider
        .getTools()
        .find((t) => t.name === 'create_game');
      expect((createTool.inputSchema.properties as any).duration.enum).toEqual(
        Object.values(GameDurationEnum),
      );
    });
  });

  describe(GameMcpProvider.prototype.handleToolCall.name, () => {
    it('should call service method for valid tool "get_available_durations"', async () => {
      mcpServiceMock.handleGetDurations.mockReturnValue(ok({ durations: [] }));

      const result = await provider.handleToolCall(
        'get_available_durations',
        {},
      );

      expect(mcpServiceMock.handleGetDurations).toHaveBeenCalled();
      expect(result.isError).toBe(false);
    });

    it('should call service method for valid tool "list_games"', async () => {
      mcpServiceMock.handleListGames.mockReturnValue(ok([]));

      const result = await provider.handleToolCall('list_games', {});

      expect(mcpServiceMock.handleListGames).toHaveBeenCalledWith({});
      expect(result.isError).toBe(false);
    });

    it('should pass args to the service method', async () => {
      mcpServiceMock.handleListGames.mockImplementation(
        (args: Record<string, unknown>) => ok(args),
      );

      await provider.handleToolCall('list_games', { skip: 10, limit: 5 });

      expect(mcpServiceMock.handleListGames).toHaveBeenCalledWith({
        skip: 10,
        limit: 5,
      });
    });

    it('should resolve playerId from JWT token when not in args', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'jwt-user',
        isGuest: true,
      });
      mcpServiceMock.handleListGames.mockImplementation(
        (args: Record<string, unknown>) => ok(args),
      );

      await provider.handleToolCall('list_games', { token: 'some-jwt' });

      expect(mcpServiceMock.handleListGames).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'jwt-user' }),
      );
    });

    it('should resolve playerId from accessToken when provided', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'acc-user',
        isGuest: false,
      });
      mcpServiceMock.handleGetGame.mockImplementation(
        (args: Record<string, unknown>) => ok(args),
      );

      await provider.handleToolCall('get_game', {
        accessToken: 'tok',
        gameId: 'g1',
      });

      expect(mcpServiceMock.handleGetGame).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'acc-user' }),
      );
    });

    it('should call service method for valid tool "create_game"', async () => {
      mcpServiceMock.handleCreateGame.mockReturnValue(
        ok({ game: {}, matched: false }),
      );

      const result = await provider.handleToolCall('create_game', {
        playerId: 'p1',
        duration: '5min',
      });

      expect(mcpServiceMock.handleCreateGame).toHaveBeenCalled();
      expect(result.isError).toBe(false);
    });

    it('should call service method for valid tool "get_board"', async () => {
      mcpServiceMock.handleGetBoard.mockReturnValue(
        ok({ board: { fen: '', board: [] }, gameId: 'g1' }),
      );

      const result = await provider.handleToolCall('get_board', {
        gameId: 'g1',
      });

      expect(mcpServiceMock.handleGetBoard).toHaveBeenCalledWith({
        gameId: 'g1',
      });
      expect(result.isError).toBe(false);
    });

    it('should call service method for valid tool "make_move"', async () => {
      mcpServiceMock.handleMakeMove.mockReturnValue(
        ok({ game: {}, move: 'e4', success: true }),
      );

      const result = await provider.handleToolCall('make_move', {
        gameId: 'g1',
        move: 'e4',
        playerId: 'p1',
      });

      expect(mcpServiceMock.handleMakeMove).toHaveBeenCalledWith(
        expect.objectContaining({ gameId: 'g1' }),
      );
      expect(result.isError).toBe(false);
    });

    it('should call service method for valid tool "claim_timeout"', async () => {
      mcpServiceMock.handleClaimTimeout.mockReturnValue(
        ok({ game: {}, message: 'Timeout claimed' }),
      );

      const result = await provider.handleToolCall('claim_timeout', {
        gameId: 'g1',
        playerId: 'p1',
      });

      expect(mcpServiceMock.handleClaimTimeout).toHaveBeenCalledWith({
        gameId: 'g1',
        playerId: 'p1',
      });
      expect(result.isError).toBe(false);
    });

    it('should call service method for valid tool "get_player_info"', async () => {
      mcpServiceMock.handleGetPlayerInfo.mockReturnValue(
        ok({ player: { userId: 'u1', nickname: 'Test', rating: 1200 } }),
      );

      const result = await provider.handleToolCall('get_player_info', {
        userId: 'u1',
      });

      expect(mcpServiceMock.handleGetPlayerInfo).toHaveBeenCalledWith({
        userId: 'u1',
      });
      expect(result.isError).toBe(false);
    });

    it('should resolve playerId from authorization header when provided', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'auth-user',
        isGuest: false,
      });
      mcpServiceMock.handleGetGame.mockImplementation(
        (args: Record<string, unknown>) => ok(args),
      );

      await provider.handleToolCall('get_game', {
        authorization: 'tok',
        gameId: 'g1',
      });

      expect(mcpServiceMock.handleGetGame).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'auth-user' }),
      );
    });

    it('should NOT override existing playerId when it is already set', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'jwt-user',
        isGuest: false,
      });
      mcpServiceMock.handleGetGame.mockImplementation(
        (args: Record<string, unknown>) => ok(args),
      );

      await provider.handleToolCall('get_game', {
        playerId: 'explicit-player',
        token: 'tok',
        gameId: 'g1',
      });

      expect(mcpServiceMock.handleGetGame).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'explicit-player' }),
      );
    });

    it('should return error for unknown tool name', async () => {
      const result = await provider.handleToolCall('nonexistent_tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Unknown tool: nonexistent_tool',
      );
    });

    it('should return error when a declared tool is not implemented', async () => {
      const getToolsSpy = jest
        .spyOn(provider, 'getTools')
        .mockReturnValue([
          { name: 'phantom_tool', description: 'Ghost', inputSchema: {} },
        ]);

      const result = await provider.handleToolCall('phantom_tool', {});

      getToolsSpy.mockRestore();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        'Tool "phantom_tool" not implemented',
      );
    });

    it('should return error wrapped message when service throws', async () => {
      mcpServiceMock.handleGetGame.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await provider.handleToolCall('get_game', {
        gameId: 'g1',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Database error');
    });

    it('should stringify non-Error exceptions', async () => {
      mcpServiceMock.handleGetGame.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'String error message';
      });

      const result = await provider.handleToolCall('get_game', {
        gameId: 'g1',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('String error message');
    });

    it('should handle JWT verification failure gracefully', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('Invalid token'));
      mcpServiceMock.handleListGames.mockReturnValue(ok([]));

      await provider.handleToolCall('list_games', { token: 'invalid' });

      // Should not have resolved playerId since JWT failed
      expect(mcpServiceMock.handleListGames).not.toHaveBeenCalledWith(
        expect.objectContaining({ playerId: expect.any(String) }),
      );
    });
  });

  describe(GameMcpProvider.prototype.getResources.name, () => {
    it('should return two resource definitions', () => {
      expect(provider.getResources().length).toBe(2);
    });

    it('should have chess://games/{id} resource', () => {
      const resources = provider.getResources();
      const gameResource = resources.find(
        (r) => r.uri === 'chess://games/{id}',
      );
      expect(gameResource?.name).toBe('Game State');
      expect(gameResource?.mimeType).toBe('application/json');
    });

    it('should have chess://board/{id} resource', () => {
      const resources = provider.getResources();
      const boardResource = resources.find(
        (r) => r.uri === 'chess://board/{id}',
      );
      expect(boardResource?.name).toBe('Board Visual');
      expect(boardResource?.mimeType).toBe('application/json');
    });
  });

  describe(GameMcpProvider.prototype.handleReadResource.name, () => {
    beforeEach(() => {
      mcpServiceMock.findGame.mockResolvedValue(null);
      mcpServiceMock.loadChessGame.mockReturnValue(new Chess());
    });

    it('should return not found for invalid URI format', async () => {
      const result = await provider.handleReadResource('invalid-uri');
      expect(result.contents[0].text).toContain('not found');
    });

    it('should return not found when game does not exist', async () => {
      const result = await provider.handleReadResource(
        'chess://games/nonexistent',
      );
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.error).toContain('Game nonexistent not found');
    });

    it('should return game data for valid games resource', async () => {
      const mockGame = {
        _id: 'game1',
        duration: '5min',
        status: 'in_progress',
        fen: 'test-fen',
        pgn: '',
        toJSON: () => ({ id: 'game1' }),
      };
      mcpServiceMock.findGame.mockResolvedValue(mockGame);

      const result = await provider.handleReadResource('chess://games/game1');
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed._id).toBe('game1');
      expect(parsed.duration).toBe('5min');
    });

    it('should return board data for valid board resource', async () => {
      const mockGame = {
        _id: 'game1',
        fen: new Chess().fen(),
        pgn: '',
        toJSON: () => ({}),
      };
      mcpServiceMock.findGame.mockResolvedValue(mockGame);

      const result = await provider.handleReadResource('chess://board/game1');
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toHaveProperty('fen');
      expect(parsed).toHaveProperty('board');
    });

    it('should return not found message for unrecognized resource kind', async () => {
      const result = await provider.handleReadResource(
        'chess://unknown/something',
      );
      expect(result.contents[0].text).toContain('not found');
    });
  });
});
