import { UnprocessableEntityError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable, injectAll } from 'tsyringe';
import { SERVICES } from '@src/common/constants';
import { components } from '@src/openapi';

export type InfoOptions = components['schemas']['InfoRequestBody'];
export type InfoResponse = components['schemas']['InfoResponse'];
export interface FileHandler {
  supports: (filePath: string) => boolean;
  getInfo: (filePath: string) => Promise<InfoResponse>;
}

@injectable()
export class InfoManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @injectAll('FileHandler') private readonly fileHandlers: FileHandler[]
  ) {}

  public async info(options: InfoOptions): Promise<InfoResponse> {
    const { demFilePath } = options;

    this.logger.debug({ msg: `Handling info request`, resource: options });
    const response = await this.process(demFilePath);
    this.logger.debug({ msg: `Info response`, response });

    return response;
  }

  private async process(filePath: string): Promise<InfoResponse> {
    const handler = this.fileHandlers.find((handler) => handler.supports(filePath));

    if (!handler) {
      throw new UnprocessableEntityError(`No handler found for file: ${filePath}`);
    }

    const info = await handler.getInfo(filePath);
    return info;
  }
}
