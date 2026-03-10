import type { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { type Registry, Counter } from 'prom-client';
import type { TypedRequestHandlers } from '@openapi';
import { SERVICES } from '@common/constants';

import { DEMManager } from '../models/demManager';

@injectable()
export class DEMController {
  private readonly demEditCounter: Counter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(DEMManager) private readonly demManager: DEMManager,
    @inject(SERVICES.METRICS) private readonly metricsRegistry: Registry
  ) {
    this.demEditCounter = new Counter({
      name: 'edit',
      help: 'number of edit requests',
      registers: [this.metricsRegistry],
    });
  }

  public edit: TypedRequestHandlers['edit'] = (req, res, next) => {
    try {
      this.demEditCounter.inc(1);
      const response = this.demManager.edit({ ...req.params, ...req.body });
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
}
