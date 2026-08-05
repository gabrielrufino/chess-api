const fs = require('fs');
let content = fs.readFileSync('src/game/services/game.service.spec.ts', 'utf8');
content = content.replace(
  `      const error = 'String Error';\n      jest\n        .spyOn(service['gameGateway'], 'emitGameUpdated')\n        .mockImplementation(() => {\n          throw error;\n        });`,
  `      const error = 'String Error';\n      jest\n        .spyOn(service['gameGateway'], 'emitGameUpdated')\n        .mockImplementation(() => {\n          // eslint-disable-next-line @typescript-eslint/only-throw-error\n          throw error;\n        });`
);
fs.writeFileSync('src/game/services/game.service.spec.ts', content);
