import { GameDurationEnum } from '../enumerables/game-duration.enum';

export interface TimeControl {
  initialTimeMs: number;
  incrementMs: number;
}

export function parseGameDuration(
  duration: GameDurationEnum,
): TimeControl | null {
  if (duration === GameDurationEnum.Unlimited) {
    return null;
  }

  // Handle 'Xmin' format
  if (duration.endsWith('min')) {
    const minutes = parseInt(duration.replace('min', ''), 10);
    return {
      initialTimeMs: minutes * 60 * 1000,
      incrementMs: 0,
    };
  }

  // Handle 'X+Y' format
  if (duration.includes('+')) {
    const [minutesStr, incrementStr] = duration.split('+');
    const minutes = parseInt(minutesStr, 10);
    const incrementSeconds = parseInt(incrementStr, 10);
    return {
      initialTimeMs: minutes * 60 * 1000,
      incrementMs: incrementSeconds * 1000,
    };
  }

  return null;
}
