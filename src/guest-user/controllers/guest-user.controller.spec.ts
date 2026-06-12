import { Test, TestingModule } from '@nestjs/testing';
import { GuestUserController } from './guest-user.controller';
import { GuestUserService } from '../services/guest-user.service';

describe(GuestUserController.name, () => {
  let controller: GuestUserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: GuestUserService,
          useValue: {},
        },
      ],
      controllers: [GuestUserController],
    }).compile();

    controller = module.get<GuestUserController>(GuestUserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
