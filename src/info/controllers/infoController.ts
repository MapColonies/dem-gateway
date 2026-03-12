import { UnprocessableEntityError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { type Registry, Counter } from 'prom-client';
import { inject, injectable } from 'tsyringe';
import { ZodError } from 'zod';
import type { TypedRequestHandlers } from '@openapi';
import { SERVICES } from '@common/constants';
import { InfoManager } from '../models/infoManager';

@injectable()
export class InfoController {
  private readonly infoCounter: Counter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METRICS) private readonly metricsRegistry: Registry,
    @inject(InfoManager) private readonly infoManager: InfoManager
  ) {
    this.infoCounter = new Counter({
      name: 'info',
      help: 'number of info requests',
      registers: [this.metricsRegistry],
    });
  }

  public info: TypedRequestHandlers['info'] = async (req, res, next) => {
    try {
      this.infoCounter.inc(1);
      const response = await this.infoManager.info(req.body);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error(error);
      if (error instanceof ZodError) {
        return next(new UnprocessableEntityError(error.issues[0]?.message ?? 'validation error'));
      }
      next(error);
    }
  };
}
