import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { DEMController } from '../controllers/demController';

const demRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(DEMController);

  router.post('/:id', controller.edit);
  router.delete('/:id', controller.edit);
  router.patch('/:id', controller.edit);
  router.patch('/:id/status', controller.edit);

  return router;
};

export const DEM_ROUTER_SYMBOL = Symbol('demRouterFactory');

export { demRouterFactory };
