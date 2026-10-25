import { MCP_SERVER_INFO } from './mcp.constants';

describe('MCP constants', () => {
  it('should have correct server name', () => {
    expect(MCP_SERVER_INFO.name).toBe('chess-api');
  });

  it('should have correct server version', () => {
    expect(MCP_SERVER_INFO.version).toBe('1.0.0');
  });
});
