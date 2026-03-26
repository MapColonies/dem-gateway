import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { InfoController } from '../controllers/infoController';

const infoRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(InfoController);

  router.post('/', controller.info);

  return router;
};

export const INFO_ROUTER_SYMBOL = Symbol('infoRouterFactory');

export { infoRouterFactory };
