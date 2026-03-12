import type { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import type { TypedRequestHandlers } from '@openapi';
import { SERVICES } from '@src/common/constants';
import { DEMManager } from '../models/demManager';

@injectable()
export class DEMController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(DEMManager) private readonly demManager: DEMManager
  ) {}

  public create: TypedRequestHandlers['create'] = (req, res, next) => {
    try {
      const response = this.demManager.create(req.body);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error(error);
      next(error);
    }
  };

  public delete: TypedRequestHandlers['delete'] = (req, res, next) => {
    try {
      const response = this.demManager.delete(req.params);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error(error);
      next(error);
    }
  };

  public edit: TypedRequestHandlers['edit'] = (req, res, next) => {
    try {
      const response = this.demManager.edit({ ...req.params, ...req.body });
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error(error);
      next(error);
    }
  };

  public editStatus: TypedRequestHandlers['editStatus'] = (req, res, next) => {
    try {
      this.demManager.editStatus({ ...req.params, ...req.body });
      return res.status(httpStatus.NO_CONTENT).send();
    } catch (error) {
      this.logger.error(error);
      next(error);
    }
  };
}
