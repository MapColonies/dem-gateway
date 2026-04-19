import { faker } from '@faker-js/faker';
import { UnprocessableEntityError } from '@map-colonies/error-types';
import { jsLogger } from '@map-colonies/js-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RASTER_DATA_TYPES } from '@src/common/constants';
import { generateInfoResponse } from '@tests/helpers/faker/info.faker';
import { FileHandler, InfoManager, InfoResponse } from '../../../../src/info/models/infoManager';

describe('InfoManager', () => {
  let infoManager: InfoManager;
  let mockFileHandler: FileHandler;

  beforeEach(async () => {
    mockFileHandler = {
      name: 'mockHandler',
      supports: vi.fn(),
      getInfo: vi.fn(),
    };
    infoManager = new InfoManager(await jsLogger({ enabled: false }), [mockFileHandler, mockFileHandler]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('#info', () => {
    const format = faker.helpers.objectKey(RASTER_DATA_TYPES);

    it('should return info response when handler supports file', async () => {
      const demFilePath = '/path/to/file.tif';
      const expectedResponse: InfoResponse = generateInfoResponse(format);
      vi.mocked(mockFileHandler.supports).mockReturnValueOnce(true);
      vi.mocked(mockFileHandler.getInfo).mockResolvedValueOnce(expectedResponse);

      const response = await infoManager.info({ demFilePath });

      expect(response).toStrictEqual(expectedResponse);
      expect(mockFileHandler.supports).toHaveBeenCalledOnce();
      expect(mockFileHandler.getInfo).toHaveBeenCalledOnce();
      expect.assertions(3);
    });

    it('should use first matching handler when multiple handlers exist', async () => {
      const demFilePath = '/path/to/file.tif';
      const expectedResponse: InfoResponse = generateInfoResponse(format);
      vi.mocked(mockFileHandler.supports).mockReturnValueOnce(true);
      vi.mocked(mockFileHandler.getInfo).mockResolvedValueOnce(expectedResponse);
      vi.mocked(mockFileHandler.supports).mockReturnValueOnce(true);

      const response = await infoManager.info({ demFilePath });

      expect(response).toStrictEqual(expectedResponse);
      expect(mockFileHandler.supports).toHaveBeenCalledOnce();
      expect(mockFileHandler.getInfo).toHaveBeenCalledOnce();
      expect.assertions(3);
    });

    it('should throw UnprocessableEntityError when no handler supports file', async () => {
      const demFilePath = '/path/to/file.unknown';
      vi.mocked(mockFileHandler.supports).mockReturnValue(false);

      const response = infoManager.info({ demFilePath });

      await expect(response).rejects.toThrow(new UnprocessableEntityError(`No handler found for file: ${demFilePath}`));
      expect.assertions(1);
    });

    it('should throw an error when getting info throws an error', async () => {
      const demFilePath = '/path/to/file.tif';
      const expectedError = new Error('info error');
      vi.mocked(mockFileHandler.supports).mockReturnValueOnce(true);
      vi.mocked(mockFileHandler.getInfo).mockRejectedValueOnce(expectedError);

      const response = infoManager.info({ demFilePath });

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });
  });
});
