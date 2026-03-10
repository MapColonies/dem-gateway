import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { DEMController } from '../controllers/demController';

const demRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(DEMController);

  router.patch('/:id', controller.edit);

  return router;
};

export const DEM_ROUTER_SYMBOL = Symbol('demRouterFactory');

export { demRouterFactory };
