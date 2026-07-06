import re

with open('src/game/services/game.service.spec.ts', 'r') as f:
    content = f.read()

old_test = """    it('should throw ForbiddenException if it is not player turn', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
      });"""

new_test = """    it('should throw ForbiddenException if it is not player turn', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      });"""

content = content.replace(old_test, new_test)

old_test2 = """    it('should throw BadRequestException on invalid move', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
      });"""

new_test2 = """    it('should throw BadRequestException on invalid move', async () => {
      jest.spyOn(gameModel, 'findById').mockResolvedValue({
        whitePlayerId: 'player1',
        blackPlayerId: 'player2',
        status: GameStatusEnum.IN_PROGRESS,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      });"""

content = content.replace(old_test2, new_test2)

with open('src/game/services/game.service.spec.ts', 'w') as f:
    f.write(content)
