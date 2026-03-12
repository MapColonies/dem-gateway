import { NotImplementedError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import type { components, operations } from '@openapi';
import { SERVICES } from '@common/constants';

export type CreateOptions = components['schemas']['CreateRequestBody'];
export type DeleteOptions = operations['delete']['parameters']['path'];
export type EditOptions = components['schemas']['EditRequestBody'] & operations['edit']['parameters']['path'];
export type EditStatusOptions = components['schemas']['EditStatusRequestBody'] & operations['editStatus']['parameters']['path'];
export type DemResponse = components['schemas']['DemResponse'];

@injectable()
export class DEMManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public create(options: CreateOptions): DemResponse {
    this.logger.info({ msg: 'Create DEM resource', resource: options });

    throw new NotImplementedError('Not implemented');
  }

  public delete(options: DeleteOptions): DemResponse {
    this.logger.info({ msg: 'Delete DEM resource', resource: options });

    throw new NotImplementedError('Not implemented');
  }

  public edit(options: EditOptions): DemResponse {
    this.logger.info({ msg: 'Edit DEM resource', resource: options });

    throw new NotImplementedError('Not implemented');
  }

  public editStatus(options: EditStatusOptions): void {
    this.logger.info({ msg: 'Edit DEM status', resource: options });

    throw new NotImplementedError('Not implemented');
  }
}
