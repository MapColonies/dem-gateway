import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { logEnrichmentParamMiddlewareFactory } from '@src/common/logger';
import { DEMController } from '../controllers/demController';

const demRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(DEMController);

  router.param('id', logEnrichmentParamMiddlewareFactory('id'));

  router.post('/:id', controller.edit);
  router.delete('/:id', controller.edit);
  router.patch('/:id', controller.edit);
  router.patch('/:id/status', controller.edit);

  return router;
};

export const DEM_ROUTER_SYMBOL = Symbol('demRouterFactory');

export { demRouterFactory };
