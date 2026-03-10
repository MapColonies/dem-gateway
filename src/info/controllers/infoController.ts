import type { Logger } from '@map-colonies/js-logger';
import { type Registry, Counter } from 'prom-client';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
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
      next(error);
    }
  };
}
