import re

with open('src/game/services/game.service.ts', 'r') as f:
    content = f.read()

old = """      if (game.pgn) {
        chess.loadPgn(game.pgn);
      } else if (game.fen) {
        chess.load(game.fen);
      }"""

new = """      if (game.pgn) {
        chess.loadPgn(game.pgn);
      } else if (game.fen) {
        chess.load(game.fen);
      } else {
        throw new Error('No game state found');
      }"""

content = content.replace(old, new)

with open('src/game/services/game.service.ts', 'w') as f:
    f.write(content)
