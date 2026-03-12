import { UnprocessableEntityError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { ZodError } from 'zod';
import type { TypedRequestHandlers } from '@openapi';
import { SERVICES } from '@common/constants';
import { InfoManager } from '../models/infoManager';

@injectable()
export class InfoController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(InfoManager) private readonly infoManager: InfoManager
  ) {}

  public info: TypedRequestHandlers['info'] = async (req, res, next) => {
    try {
      const response = await this.infoManager.info(req.body);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error({ err: error });
      if (error instanceof ZodError) {
        return next(new UnprocessableEntityError(error.issues[0]?.message ?? 'validation error'));
      }
      next(error);
    }
  };
}
