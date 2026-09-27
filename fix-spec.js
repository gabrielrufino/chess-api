const fs = require('fs');
const eloTestCode = `
import { getExpectedScore, calculateNewRating, calculateRatingChanges, GameResult } from './elo.util';

describe('Elo Util', () => {
  describe('getExpectedScore', () => {
    it('should return 0.5 when ratings are equal', () => {
      expect(getExpectedScore(1200, 1200)).toBe(0.5);
    });
    
    it('should return higher probability for higher rating', () => {
      expect(getExpectedScore(1400, 1200)).toBeGreaterThan(0.5);
      expect(getExpectedScore(1200, 1400)).toBeLessThan(0.5);
    });
  });

  describe('calculateNewRating', () => {
    it('should calculate new rating correctly', () => {
      expect(calculateNewRating(1200, 0.5, 1)).toBe(1216); // win
      expect(calculateNewRating(1200, 0.5, 0)).toBe(1184); // loss
      expect(calculateNewRating(1200, 0.5, 0.5)).toBe(1200); // draw
    });
  });

  describe('calculateRatingChanges', () => {
    it('should calculate changes for white win', () => {
      const result = calculateRatingChanges(1200, 1200, GameResult.WHITE_WINS);
      expect(result.white.delta).toBe(16);
      expect(result.white.newRating).toBe(1216);
      expect(result.black.delta).toBe(-16);
      expect(result.black.newRating).toBe(1184);
    });

    it('should calculate changes for black win', () => {
      const result = calculateRatingChanges(1200, 1200, GameResult.BLACK_WINS);
      expect(result.white.delta).toBe(-16);
      expect(result.black.delta).toBe(16);
    });

    it('should calculate changes for draw', () => {
      const result = calculateRatingChanges(1200, 1200, GameResult.DRAW);
      expect(result.white.delta).toBe(0);
      expect(result.black.delta).toBe(0);
    });
  });
});
`;

fs.writeFileSync('src/game/utils/elo.util.spec.ts', eloTestCode);
console.log('Created elo util spec');
