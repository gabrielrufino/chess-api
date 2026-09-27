/**
 * Calculates the expected score for a player based on their Elo rating and their opponent's Elo rating.
 *
 * @param playerRating The Elo rating of the player
 * @param opponentRating The Elo rating of the opponent
 * @returns A number between 0 and 1 representing the expected probability of winning
 */
export function getExpectedScore(
  playerRating: number,
  opponentRating: number,
): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculates the new Elo rating for a player.
 *
 * @param currentRating The current Elo rating of the player
 * @param expectedScore The expected score (probability of winning)
 * @param actualScore The actual score (1 for win, 0.5 for draw, 0 for loss)
 * @param kFactor The K-factor which determines the maximum rating change (usually 32)
 * @returns The new calculated Elo rating
 */
export function calculateNewRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = 32,
): number {
  return Math.round(currentRating + kFactor * (actualScore - expectedScore));
}

export enum GameResult {
  WHITE_WINS = 'WHITE_WINS',
  BLACK_WINS = 'BLACK_WINS',
  DRAW = 'DRAW',
}

/**
 * Calculates the new ratings and the rating change for both players.
 *
 * @param whiteRating Current Elo rating of the white player
 * @param blackRating Current Elo rating of the black player
 * @param result The outcome of the game
 * @param kFactor The K-factor (default: 32)
 * @returns An object containing the new ratings and the rating changes (delta)
 */
export function calculateRatingChanges(
  whiteRating: number,
  blackRating: number,
  result: GameResult,
  kFactor: number = 32,
) {
  const expectedWhite = getExpectedScore(whiteRating, blackRating);
  const expectedBlack = getExpectedScore(blackRating, whiteRating);

  let actualWhite = 0;
  let actualBlack = 0;

  if (result === GameResult.WHITE_WINS) {
    actualWhite = 1;
    actualBlack = 0;
  } else if (result === GameResult.BLACK_WINS) {
    actualWhite = 0;
    actualBlack = 1;
  } else if (result === GameResult.DRAW) {
    actualWhite = 0.5;
    actualBlack = 0.5;
  }

  const newWhiteRating = calculateNewRating(
    whiteRating,
    expectedWhite,
    actualWhite,
    kFactor,
  );
  const newBlackRating = calculateNewRating(
    blackRating,
    expectedBlack,
    actualBlack,
    kFactor,
  );

  return {
    white: {
      newRating: newWhiteRating,
      delta: newWhiteRating - whiteRating,
    },
    black: {
      newRating: newBlackRating,
      delta: newBlackRating - blackRating,
    },
  };
}
