const { performance } = require('node:perf_hooks');

const GameDurationEnum = {
  Unlimited: 'Unlimited',
  OneMinute: '1|0',
  ThreePlusTwo: '3|2',
  FiveMinutes: '5|0',
  FivePlusThree: '5|3',
  TenMinutes: '10|0',
  TenPlusFive: '10|5',
  FifteenPlusTen: '15|10',
};

function getDurationsCurrent() {
  const labels = {
    [GameDurationEnum.Unlimited]: 'Unlimited',
    [GameDurationEnum.OneMinute]: '1 minute',
    [GameDurationEnum.ThreePlusTwo]: '3 min + 2 sec',
    [GameDurationEnum.FiveMinutes]: '5 minutes',
    [GameDurationEnum.FivePlusThree]: '5 min + 3 sec',
    [GameDurationEnum.TenMinutes]: '10 minutes',
    [GameDurationEnum.TenPlusFive]: '10 min + 5 sec',
    [GameDurationEnum.FifteenPlusTen]: '15 min + 10 sec',
  };

  return Object.values(GameDurationEnum).map((value) => ({
    value,
    label: labels[value] || value,
  }));
}

const GAME_DURATIONS_LABELS = {
  [GameDurationEnum.Unlimited]: 'Unlimited',
  [GameDurationEnum.OneMinute]: '1 minute',
  [GameDurationEnum.ThreePlusTwo]: '3 min + 2 sec',
  [GameDurationEnum.FiveMinutes]: '5 minutes',
  [GameDurationEnum.FivePlusThree]: '5 min + 3 sec',
  [GameDurationEnum.TenMinutes]: '10 minutes',
  [GameDurationEnum.TenPlusFive]: '10 min + 5 sec',
  [GameDurationEnum.FifteenPlusTen]: '15 min + 10 sec',
};

const CACHED_DURATIONS = Object.values(GameDurationEnum).map((value) => ({
  value,
  label: GAME_DURATIONS_LABELS[value] || value,
}));

function getDurationsOptimized() {
  return CACHED_DURATIONS;
}

const ITERATIONS = 1000000;

const startCurrent = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  getDurationsCurrent();
}
const endCurrent = performance.now();

const startOptimized = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  getDurationsOptimized();
}
const endOptimized = performance.now();

console.log(`Current: ${endCurrent - startCurrent} ms`);
console.log(`Optimized: ${endOptimized - startOptimized} ms`);
console.log(`Improvement: ${((endCurrent - startCurrent) / (endOptimized - startOptimized)).toFixed(2)}x`);
