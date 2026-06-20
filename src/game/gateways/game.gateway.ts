import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import type { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { plainToInstance } from 'class-transformer';
import { Game, GameDocument } from '../schemas/game.schema';
import { GameDto, GameBoardDto } from '../dto/game-response.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    @InjectModel(Game.name)
    private readonly gameModel: Model<GameDocument>,
  ) {}

  @SubscribeMessage('join-game')
  async handleJoinGame(
    @MessageBody() gameId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!gameId || !isValidObjectId(gameId)) return { joined: false };

    const game = await this.gameModel.findById(gameId);
    if (!game) return { joined: false };

    await client.join(gameId);

    const chess = new Chess();
    try {
      if (game.pgn) chess.loadPgn(game.pgn);
      else if (game.fen) chess.load(game.fen);
    } catch (err) {
      this.logger.warn(
        `Could not load game state for game ${gameId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const board: GameBoardDto = { fen: chess.fen(), board: chess.board() };
    client.emit('game-updated', {
      game: plainToInstance(GameDto, game.toJSON()),
      board,
    });

    return { joined: true };
  }

  emitGameUpdated(gameId: string, game: GameDto, board: GameBoardDto) {
    this.server.to(gameId).emit('game-updated', { game, board });
  }
}
