import { injectable, injectAll } from 'tsyringe';
import { UnprocessableEntityError } from '@map-colonies/error-types';
import { components } from '@src/openapi';

export type InfoOptions = components['schemas']['InfoRequestBody'];
export type InfoResponse = components['schemas']['InfoResponse'];
export interface FileHandler {
  supports: (filePath: string) => boolean;
  getInfo: (filePath: string) => Promise<InfoResponse>;
}

@injectable()
export class InfoManager {
  public constructor(@injectAll('FileHandler') private readonly fileHandlers: FileHandler[]) {}

  public async info(options: InfoOptions): Promise<InfoResponse> {
    const { demFilePath } = options;

    const response = await this.process(demFilePath);

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
