import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import type { components, operations } from '@openapi';
import { SERVICES } from '@common/constants';

export type EditOptions = components['schemas']['EditRequestBody'] & operations['edit']['parameters']['path'];
export type DemResponse = components['schemas']['DemResponse'];

@injectable()
export class DEMManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public edit(options: EditOptions): DemResponse {
    this.logger.info({ msg: 'editing resource', resource: options });

    return { jobId: '795bfb61-9c26-4860-aae3-ef071219cdff' };
  }
}
