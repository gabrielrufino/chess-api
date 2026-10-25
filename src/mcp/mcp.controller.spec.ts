/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/unbound-method */
import { Request, Response } from 'express';
import { McpGatewayController } from './mcp.controller';

jest.mock('@modelcontextprotocol/node', () => {
  const instances: any[] = [];
  const state = { closeImpl: () => Promise.resolve() };
  const NodeStreamableHTTPServerTransport = jest
    .fn()
    .mockImplementation((options: any = {}) => {
      const transport: any = {
        options,
        sessionId: options.sessionIdGenerator
          ? options.sessionIdGenerator()
          : undefined,
        handleRequest: jest.fn(),
        close: jest.fn(() => state.closeImpl()),
        onclose: undefined,
      };
      transport.handleRequest.mockImplementation(() => {
        if (options.onsessioninitialized && transport.sessionId) {
          options.onsessioninitialized(transport.sessionId);
        }
        return Promise.resolve();
      });
      instances.push(transport);
      return transport;
    });

  return {
    NodeStreamableHTTPServerTransport,
    __instances: instances,
    __state: state,
  };
});

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  const instances: any[] = [];
  const state = { connectImpl: () => Promise.resolve() };

  const McpServer = jest.fn().mockImplementation((info: any) => {
    const server: any = {
      info,
      registeredTools: [] as any[],
      registerTool: jest.fn(
        (name: string, config: unknown, handler: unknown) => {
          server.registeredTools.push({ name, config, handler });
        },
      ),
      connect: jest.fn(() => state.connectImpl()),
      close: jest.fn().mockResolvedValue(undefined),
    };
    instances.push(server);
    return server;
  });

  return { McpServer, __instances: instances, __state: state };
});

const nodeModule = jest.requireMock('@modelcontextprotocol/node');
const mcpSdkModule = jest.requireMock(
  '@modelcontextprotocol/sdk/server/mcp.js',
);

const transportInstances: any[] = nodeModule.__instances;
const transportState: { closeImpl: () => Promise<unknown> } =
  nodeModule.__state;
const serverInstances: any[] = mcpSdkModule.__instances;
const serverState: { connectImpl: () => Promise<unknown> } =
  mcpSdkModule.__state;

function makeRequest(overrides: Record<string, unknown> = {}): Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeResponse(): Response {
  const response: any = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  response.send = jest.fn().mockReturnValue(response);
  return response as Response;
}

describe(McpGatewayController.name, () => {
  let provider: any;
  let controller: McpGatewayController;
  const controllers: McpGatewayController[] = [];

  const createController = (): McpGatewayController => {
    const instance = new McpGatewayController(provider);
    controllers.push(instance);
    return instance;
  };

  const sessionsOf = (instance: McpGatewayController): Map<string, any> =>
    (instance as any).sessions;

  const initializeSession = async (
    authorization?: string,
  ): Promise<{ request: Request; response: Response; transport: any }> => {
    const request = makeRequest({
      headers: authorization ? { authorization } : {},
      body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
    });
    const response = makeResponse();

    await controller.handleMessage(request, response);

    return {
      request,
      response,
      transport: transportInstances[transportInstances.length - 1],
    };
  };

  beforeEach(() => {
    transportInstances.length = 0;
    serverInstances.length = 0;
    serverState.connectImpl = () => Promise.resolve();
    transportState.closeImpl = () => Promise.resolve();

    provider = {
      getTools: jest.fn(() => [
        {
          name: 'get_game',
          description: 'Get a game',
          inputSchema: { type: 'object' },
        },
        {
          name: 'make_move',
          description: 'Make a move',
          inputSchema: { type: 'object' },
        },
      ]),
      handleToolCall: jest.fn().mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: '{"ok":true}' }],
      }),
    };

    controller = createController();
  });

  afterEach(() => {
    controllers.forEach((instance) => instance.onModuleDestroy());
    controllers.length = 0;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe(McpGatewayController.prototype.onModuleDestroy.name, () => {
    it('should clear the cleanup timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      controller.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalledWith(
        (controller as any).cleanupTimer,
      );
    });

    it('should do nothing when there is no cleanup timer', () => {
      const cleanupTimer = (controller as any).cleanupTimer;
      (controller as any).cleanupTimer = null;
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      controller.onModuleDestroy();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
      (controller as any).cleanupTimer = cleanupTimer;
    });
  });

  describe('evictExpiredSessions', () => {
    it('should remove expired sessions and close their transport and server', async () => {
      const transport = { close: jest.fn().mockResolvedValue(undefined) };
      const server = {
        close: jest.fn().mockRejectedValue(new Error('server close failed')),
      };
      sessionsOf(controller).set('expired', {
        transport,
        server,
        sessionId: 'expired',
        createdAt: Date.now() - 6 * 60 * 1000,
      });

      await (controller as any).evictExpiredSessions();

      expect(sessionsOf(controller).has('expired')).toBe(false);
      expect(transport.close).toHaveBeenCalled();
      expect(server.close).toHaveBeenCalled();
    });

    it('should keep sessions that are still within their TTL', async () => {
      const transport = { close: jest.fn() };
      sessionsOf(controller).set('fresh', {
        transport,
        server: null,
        sessionId: 'fresh',
        createdAt: Date.now(),
      });

      await (controller as any).evictExpiredSessions();

      expect(sessionsOf(controller).has('fresh')).toBe(true);
      expect(transport.close).not.toHaveBeenCalled();
    });

    it('should evict sessions without a server and swallow close errors', async () => {
      const transport = {
        close: jest.fn().mockRejectedValue(new Error('close failed')),
      };
      sessionsOf(controller).set('expired', {
        transport,
        server: null,
        sessionId: 'expired',
        createdAt: Date.now() - 6 * 60 * 1000,
      });

      await expect(
        (controller as any).evictExpiredSessions(),
      ).resolves.toBeUndefined();
      expect(sessionsOf(controller).has('expired')).toBe(false);
      expect(transport.close).toHaveBeenCalled();
    });

    it('should evict sessions periodically through the cleanup timer', async () => {
      jest.useFakeTimers();
      const periodicController = createController();
      const transport = { close: jest.fn().mockResolvedValue(undefined) };
      sessionsOf(periodicController).set('expired', {
        transport,
        server: null,
        sessionId: 'expired',
        createdAt: Date.now() - 6 * 60 * 1000,
      });

      await jest.advanceTimersByTimeAsync(60_000);

      expect(sessionsOf(periodicController).has('expired')).toBe(false);
      expect(transport.close).toHaveBeenCalled();
    });

    it('should swallow failures raised by the periodic cleanup', async () => {
      jest.useFakeTimers();
      const periodicController = createController();
      const evictSpy = jest
        .spyOn(periodicController as any, 'evictExpiredSessions')
        .mockRejectedValue(new Error('eviction failed'));

      await jest.advanceTimersByTimeAsync(60_000);

      expect(evictSpy).toHaveBeenCalled();
    });
  });

  describe(McpGatewayController.prototype.handleSse.name, () => {
    it('should delegate GET requests to the session transport', async () => {
      const transport = {
        handleRequest: jest.fn().mockResolvedValue(undefined),
      };
      sessionsOf(controller).set('session-1', {
        transport,
        server: null,
        sessionId: 'session-1',
        createdAt: Date.now(),
      });
      const request = makeRequest({
        headers: { 'mcp-session-id': 'session-1' },
      });
      const response = makeResponse();

      await controller.handleSse(response, request);

      expect(transport.handleRequest).toHaveBeenCalledWith(request, response);
    });

    it('should return 400 when the session ID header is missing', async () => {
      const response = makeResponse();

      await controller.handleSse(response, makeRequest());

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith(
        'Missing or invalid session ID',
      );
    });

    it('should return 400 when the session ID is unknown', async () => {
      const response = makeResponse();

      await controller.handleSse(
        response,
        makeRequest({ headers: { 'mcp-session-id': 'unknown' } }),
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith(
        'Missing or invalid session ID',
      );
    });
  });

  describe(McpGatewayController.prototype.handleMessage.name, () => {
    it('should delegate POST requests to an existing session transport', async () => {
      const transport = {
        handleRequest: jest.fn().mockResolvedValue(undefined),
      };
      sessionsOf(controller).set('session-1', {
        transport,
        server: null,
        sessionId: 'session-1',
        createdAt: Date.now(),
      });
      const request = makeRequest({
        headers: { 'mcp-session-id': 'session-1' },
        body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      });
      const response = makeResponse();

      await controller.handleMessage(request, response);

      expect(transport.handleRequest).toHaveBeenCalledWith(
        request,
        response,
        request.body,
      );
    });

    it('should return 400 for a non-initialize request without a session', async () => {
      const request = makeRequest({
        body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      });
      const response = makeResponse();

      await controller.handleMessage(request, response);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        error: 'Session ID required or invalid session',
      });
      expect(transportInstances).toHaveLength(0);
    });

    it('should return 400 when the request body is empty', async () => {
      const response = makeResponse();

      await controller.handleMessage(
        makeRequest({ body: undefined }),
        response,
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        error: 'Session ID required or invalid session',
      });
    });

    it('should initialize a session with a new transport and MCP server', async () => {
      const { request, response, transport } = await initializeSession(
        'Bearer session-token',
      );

      expect(transportInstances).toHaveLength(1);
      expect(transport.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(transport.handleRequest).toHaveBeenCalledWith(
        request,
        response,
        request.body,
      );

      const server = serverInstances[0];
      expect(server.info).toEqual({ name: 'chess-mcp', version: '1.0.0' });
      expect(server.connect).toHaveBeenCalledWith(transport);
      expect(server.registerTool).toHaveBeenCalledTimes(2);
      expect(sessionsOf(controller).get(transport.sessionId)).toEqual(
        expect.objectContaining({
          transport,
          server,
          sessionId: transport.sessionId,
          _token: 'session-token',
        }),
      );
    });

    it('should not cache an auth token when the Authorization header is absent', async () => {
      const { transport } = await initializeSession();
      const session = sessionsOf(controller).get(transport.sessionId);

      expect(session._token).toBeUndefined();
    });

    it('should register tools with title, description and annotations', async () => {
      await initializeSession();
      const server = serverInstances[0];

      expect(server.registerTool).toHaveBeenNthCalledWith(
        1,
        'get_game',
        expect.objectContaining({
          title: 'get_game',
          description: 'Get a game',
          annotations: { readOnlyHint: true },
        }),
        expect.any(Function),
      );
    });

    it('should close the transport and return 500 when initialization fails', async () => {
      serverState.connectImpl = () =>
        Promise.reject(new Error('connection refused'));
      const response = makeResponse();

      await controller.handleMessage(
        makeRequest({ body: { method: 'initialize' } }),
        response,
      );

      expect(transportInstances[0].close).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        error: 'Failed to initialize MCP session',
      });
      expect(sessionsOf(controller).size).toBe(0);
    });

    it('should stringify non-Error initialization failures', async () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      serverState.connectImpl = () => Promise.reject('plain failure');
      const response = makeResponse();

      await controller.handleMessage(
        makeRequest({ body: { method: 'initialize' } }),
        response,
      );

      expect(response.status).toHaveBeenCalledWith(500);
      expect(transportInstances[0].close).toHaveBeenCalled();
    });

    it('should swallow transport close errors during a failed initialization', async () => {
      serverState.connectImpl = () => Promise.reject(new Error('boom'));
      transportState.closeImpl = () =>
        Promise.reject(new Error('close failed'));
      const response = makeResponse();

      await controller.handleMessage(
        makeRequest({ body: { method: 'initialize' } }),
        response,
      );

      expect(response.status).toHaveBeenCalledWith(500);
      expect(transportInstances[0].close).toHaveBeenCalled();
    });

    it('should remove the session when the transport closes', async () => {
      const { transport } = await initializeSession();

      transport.onclose();

      expect(sessionsOf(controller).has(transport.sessionId)).toBe(false);
    });

    it('should ignore transport close events without a session ID', async () => {
      const { transport } = await initializeSession();
      transport.sessionId = undefined;

      transport.onclose();

      expect(sessionsOf(controller).size).toBe(1);
    });
  });

  describe('registered tool callback', () => {
    it('should forward tool calls to the provider', async () => {
      await initializeSession();
      const handler = serverInstances[0].registeredTools[0].handler;

      const result = await handler({ gameId: 'game-1' });

      expect(provider.handleToolCall).toHaveBeenCalledWith('get_game', {
        gameId: 'game-1',
      });
      expect(result).toEqual({
        content: [{ type: 'text', text: '{"ok":true}' }],
      });
    });

    it('should inject the session token into tool arguments', async () => {
      await initializeSession('Bearer cached-token');
      const handler = serverInstances[0].registeredTools[0].handler;

      await handler({ gameId: 'game-1' });

      expect(provider.handleToolCall).toHaveBeenCalledWith('get_game', {
        gameId: 'game-1',
        token: 'cached-token',
      });
    });

    it('should not inject a token when the arguments already carry one', async () => {
      await initializeSession('Bearer cached-token');
      const handler = serverInstances[0].registeredTools[0].handler;

      await handler({ gameId: 'game-1', token: 'explicit-token' });

      expect(provider.handleToolCall).toHaveBeenCalledWith('get_game', {
        gameId: 'game-1',
        token: 'explicit-token',
      });
    });

    it('should not inject a token when the session is gone', async () => {
      await initializeSession('Bearer cached-token');
      sessionsOf(controller).clear();
      const handler = serverInstances[0].registeredTools[0].handler;

      await handler({ gameId: 'game-1' });

      expect(provider.handleToolCall).toHaveBeenCalledWith('get_game', {
        gameId: 'game-1',
      });
    });

    it('should propagate provider errors as MCP error results', async () => {
      provider.handleToolCall.mockResolvedValue({
        isError: true,
        content: [{ type: 'text', text: 'Error: nope' }],
      });
      await initializeSession();
      const handler = serverInstances[0].registeredTools[0].handler;

      const result = await handler({ gameId: 'missing' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: nope' }],
        isError: true,
      });
    });
  });

  describe('extractAuthHeader', () => {
    it('should extract a bearer token', () => {
      expect(
        (controller as any).extractAuthHeader(
          makeRequest({ headers: { authorization: 'Bearer abc' } }),
        ),
      ).toBe('abc');
    });

    it('should be case-insensitive for the bearer scheme', () => {
      expect(
        (controller as any).extractAuthHeader(
          makeRequest({ headers: { authorization: 'bearer abc' } }),
        ),
      ).toBe('abc');
    });

    it('should return undefined for other schemes', () => {
      expect(
        (controller as any).extractAuthHeader(
          makeRequest({ headers: { authorization: 'Basic abc' } }),
        ),
      ).toBeUndefined();
    });

    it('should return undefined for malformed headers', () => {
      expect(
        (controller as any).extractAuthHeader(
          makeRequest({ headers: { authorization: 'Bearer' } }),
        ),
      ).toBeUndefined();
    });

    it('should return undefined when there is no Authorization header', () => {
      expect(
        (controller as any).extractAuthHeader(makeRequest()),
      ).toBeUndefined();
    });
  });
});
