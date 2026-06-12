import { GameDurationEnum } from '../enumerables/game-duration.enum';
import { parseGameDuration } from './time-control.util';

describe('TimeControlUtil', () => {
  describe('parseGameDuration', () => {
    it('should return null for unlimited duration', () => {
      const result = parseGameDuration(GameDurationEnum.Unlimited);
      expect(result).toBeNull();
    });

    it('should parse "Xmin" format correctly (1 minute)', () => {
      const result = parseGameDuration(GameDurationEnum.OneMinute);
      expect(result).toEqual({
        initialTimeMs: 60 * 1000,
        incrementMs: 0,
      });
    });

    it('should parse "Xmin" format correctly (5 minutes)', () => {
      const result = parseGameDuration(GameDurationEnum.FiveMinutes);
      expect(result).toEqual({
        initialTimeMs: 5 * 60 * 1000,
        incrementMs: 0,
      });
    });

    it('should parse "Xmin" format correctly (10 minutes)', () => {
      const result = parseGameDuration(GameDurationEnum.TenMinutes);
      expect(result).toEqual({
        initialTimeMs: 10 * 60 * 1000,
        incrementMs: 0,
      });
    });

    it('should parse "X+Y" format correctly (3+2)', () => {
      const result = parseGameDuration(GameDurationEnum.ThreePlusTwo);
      expect(result).toEqual({
        initialTimeMs: 3 * 60 * 1000,
        incrementMs: 2 * 1000,
      });
    });

    it('should parse "X+Y" format correctly (5+3)', () => {
      const result = parseGameDuration(GameDurationEnum.FivePlusThree);
      expect(result).toEqual({
        initialTimeMs: 5 * 60 * 1000,
        incrementMs: 3 * 1000,
      });
    });

    it('should parse "X+Y" format correctly (10+5)', () => {
      const result = parseGameDuration(GameDurationEnum.TenPlusFive);
      expect(result).toEqual({
        initialTimeMs: 10 * 60 * 1000,
        incrementMs: 5 * 1000,
      });
    });

    it('should parse "X+Y" format correctly (15+10)', () => {
      const result = parseGameDuration(GameDurationEnum.FifteenPlusTen);
      expect(result).toEqual({
        initialTimeMs: 15 * 60 * 1000,
        incrementMs: 10 * 1000,
      });
    });

    it('should return null for unrecognized format', () => {
      // @ts-expect-error Testing invalid input
      const result = parseGameDuration('invalid-format');
      expect(result).toBeNull();
    });
  });
});
