import * as nodeFsPromise from 'node:fs/promises';
import { faker } from '@faker-js/faker';
import { jsLogger } from '@map-colonies/js-logger';
import { createRequestSender, RequestSender } from '@map-colonies/openapi-helpers/requestSender';
import { trace } from '@opentelemetry/api';
import * as gdalAsync from 'gdal-async';
import { Dataset, DatasetBands, Driver } from 'gdal-async';
import httpStatusCodes from 'http-status-codes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { operations, paths } from '@openapi';
import { getApp } from '@src/app';
import { getConfig } from '@src/common/config';
import { RASTER_DATA_TYPES, SERVICES } from '@src/common/constants';
import { hasKey } from '@src/common/utils';
import { createInfoMetadata, createInfoResource } from '@tests/helpers/faker/info.faker';

vi.mock('node:fs/promises', { spy: true });

const seed = process.env.TEST_SEED ?? Math.floor(Math.random() * 1000000);
faker.seed(Number(seed));
console.info(`Test seed: ${seed}`);

const config = getConfig();

const supportedFormatsMap: Record<string, string> = config.get('application.supportedFormatsMap');

const happyTests = Object.keys(supportedFormatsMap).map((supportedFormat) => {
  if (!hasKey(supportedFormat, RASTER_DATA_TYPES)) {
    throw new Error(`Format '${supportedFormat}' is not part of service's API`);
  }
  return { demType: supportedFormat };
});

describe('POST /info', () => {
  type InfoRequestBody = paths['/info']['post']['requestBody']['content']['application/json'];
  let requestSender: RequestSender<paths, operations>;

  beforeEach(async () => {
    const [app] = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = await createRequestSender<paths, operations>('openapi3.yaml', app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path', () => {
    it.for(happyTests)('should return 200 status code and respond with dem info for $demType', async ({ demType }) => {
      const metadata = createInfoMetadata({ demType });
      const demFilePath = await createInfoResource(metadata);
      const { areaOrPoint, resolutionDegree, resolutionMeter, srsId, srsName, dataType, noDataValue } = metadata;
      const expected = { areaOrPoint, resolutionDegree, resolutionMeter, srsId, srsName, dataType, noDataValue };

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toStrictEqual(expected);
      expect.assertions(3);
    });
  });

  describe('Bad Path', () => {
    type InfoResponseBody = paths['/info']['post']['responses'][400]['content']['application/json'];

    it('should return 400 status code and respond with error message when request body is incorrect', async () => {
      const response = await requestSender.info({ requestBody: false as unknown as InfoRequestBody });

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBody).message).toBe('Unexpected token \'f\', "false" is not valid JSON');
      expect.assertions(3);
    });

    it('should return 400 status code and respond with error message when request body has redundant properties', async () => {
      const response = await requestSender.info({
        requestBody: { demFilePath: '/path/to/tif.tif', redundantProperty: '' } as unknown as InfoRequestBody,
      });

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBody).message).toBe('request/body must NOT have unevaluated properties');
      expect.assertions(3);
    });

    it('should return 400 status code and respond with error message when demFilePath property in request body has incorrect type', async () => {
      const response = await requestSender.info({
        requestBody: { demFilePath: 0 } as unknown as InfoRequestBody,
      });

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBody).message).toBe('request/body/demFilePath must be string');
      expect.assertions(3);
    });

    it('should return 400 status code and respond with error message when demFilePath property in request body does not follows validation pattern - file in root dir', async () => {
      const response = await requestSender.info({
        requestBody: { demFilePath: '/file.tif' },
      });

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBody).message).toBe(
        'request/body/demFilePath must match pattern "^(\\/?[\\w-]+)(\\/[\\w-]+)*\\/[\\wא-ת\\.-]+\\.(tif)$"'
      );
      expect.assertions(3);
    });

    it('should return 400 status code and respond with error message when demFilePath property in request body does not follows validation pattern - path contains invalid characters', async () => {
      const response = await requestSender.info({
        requestBody: { demFilePath: '/fold r/file.tif' },
      });

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBody).message).toBe(
        'request/body/demFilePath must match pattern "^(\\/?[\\w-]+)(\\/[\\w-]+)*\\/[\\wא-ת\\.-]+\\.(tif)$"'
      );
      expect.assertions(3);
    });

    it('should return 400 status code and respond with error message when demFilePath property in request body does not follows validation pattern - incorrect extension', async () => {
      const response = await requestSender.info({
        requestBody: { demFilePath: '/folder/file.tiff' },
      });

      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBody).message).toBe(
        'request/body/demFilePath must match pattern "^(\\/?[\\w-]+)(\\/[\\w-]+)*\\/[\\wא-ת\\.-]+\\.(tif)$"'
      );
      expect.assertions(3);
    });
  });

  describe('Sad Path', () => {
    type InfoResponseBodyNotFound = paths['/info']['post']['responses'][404]['content']['application/json'];

    it('should return 404 status code and respond with unsuccessful message when file does not exist', async () => {
      const demFilePath = '/non/existent/file.tif';
      const response = await requestSender.info({ requestBody: { demFilePath } });

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyNotFound).message).toStartWith(`Cannot find file: ${demFilePath}. got error:`);
      expect.assertions(3);
    });

    it('should return 404 status code and respond with unsuccessful message when file cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      vi.mocked(nodeFsPromise.access).mockRejectedValueOnce(new Error());

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyNotFound).message).toStartWith(`Cannot find file: ${demFilePath.demFilePath}. got error:`);
      expect.assertions(3);
    });

    type InfoResponseBodyUnprocessableContent = paths['/info']['post']['responses'][422]['content']['application/json'];

    it('should return 422 status code and respond with unsuccessful message when supported extensions do not include provided file', async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      vi.spyOn(Driver.prototype, 'getMetadata').mockReturnValueOnce({ DMD_EXTENSION: 'tiff' });

      const response = await requestSender.info({ requestBody: { demFilePath: '/non/existent/file.tif' } });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe('No handler found for file: /non/existent/file.tif');
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when layout in image structure metadata is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported image structure metadata (LAYOUT and COMPRESSION)';
      vi.spyOn(gdalAsync.Dataset.prototype, 'getMetadataAsync')
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ LAYOUT: '', COMPRESSION: metadata.compression });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when compression image structure metadata is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported image structure metadata (LAYOUT and COMPRESSION)';
      vi.spyOn(gdalAsync.Dataset.prototype, 'getMetadataAsync')
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ LAYOUT: metadata.layout, COMPRESSION: '' });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    }, 100000000);

    it('should return 422 status code and respond with unsuccessful message when block size is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported block size';
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band, 'blockSizeAsync', 'get').mockImplementationOnce(async () => {
            return Promise.resolve({ x: -1, y: 5 });
          });
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when overviews count is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Could not find overviews';
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band.overviews, 'countAsync').mockImplementationOnce(async () => {
            return Promise.resolve(0);
          });
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when area or point metadata is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Could not extract AREA_OR_POINT metadata';
      vi.spyOn(gdalAsync.Dataset.prototype, 'getMetadataAsync')
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ LAYOUT: metadata.layout, COMPRESSION: metadata.compression })
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .mockResolvedValueOnce({ AREA_OR_POINT: '' });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when band data type is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported band data type';
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band, 'dataTypeAsync', 'get').mockImplementationOnce(async () => {
            return Promise.resolve('invalid data type');
          });
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when nodata value is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported band nodata value';
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band, 'noDataValueAsync', 'get').mockImplementationOnce(async () => {
            return Promise.resolve(Number.POSITIVE_INFINITY);
          });
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when srs is null', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported SRS';
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset, 'srsAsync', 'get').mockImplementationOnce(async () => {
          return Promise.resolve(null); // this EPSG code should not be included in the supported srs ids config
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when srs authority code is unrecognized', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported SRS';
      vi.spyOn(gdalAsync.SpatialReference.prototype, 'getAuthorityCode').mockReturnValueOnce(undefined as unknown as string);

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when srs type is unsupported', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported SRS type';
      vi.spyOn(gdalAsync.SpatialReference.prototype, 'isGeographic').mockReturnValueOnce(false);
      vi.spyOn(gdalAsync.SpatialReference.prototype, 'isProjected').mockReturnValueOnce(false);

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when srs is unsupported', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported SRS';
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset, 'srsAsync', 'get').mockImplementationOnce(async () => {
          return Promise.resolve(gdalAsync.SpatialReference.fromEPSG(3857)); // this EPSG code should not be included in the supported srs ids config
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 422 status code and respond with unsuccessful message when geo transform is incorrect', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported geo transform';
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset, 'geoTransformAsync', 'get').mockImplementationOnce(async () => {
          return Promise.resolve([]);
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.UNPROCESSABLE_ENTITY);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyUnprocessableContent).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    type InfoResponseBodyInternalServerError = paths['/info']['post']['responses'][500]['content']['application/json'];

    it('should return 500 status code and respond with unsuccessful message when file cannot be read', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot open dataset';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockRejectedValueOnce(error);

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when band cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access band';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.DatasetBands.prototype, 'getAsync').mockRejectedValueOnce(error);

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when metadata cannot be accessed for validation', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot read metadata';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Dataset.prototype, 'getMetadataAsync')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .mockImplementationOnce(async (...args: Parameters<Dataset['getMetadataAsync']>) => gdalAsync.Dataset.prototype.getMetadataAsync(...args))
        .mockRejectedValueOnce(error);

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when block size cannot be accessed for validation', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported SRS';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band, 'blockSizeAsync', 'get').mockRejectedValueOnce(error);
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when overviews cannot be accessed for validation', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'Unsupported SRS';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band.overviews, 'countAsync').mockRejectedValueOnce(error);
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when metadata cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot read metadata';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Dataset.prototype, 'getMetadataAsync')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .mockImplementationOnce(async (...args: Parameters<Dataset['getMetadataAsync']>) => gdalAsync.Dataset.prototype.getMetadataAsync(...args))
        .mockRejectedValueOnce(error);

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when band data type cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access band data type';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band, 'dataTypeAsync', 'get').mockImplementationOnce(async () => {
            return Promise.reject(error);
          });
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when band nodata value cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access nodata value';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset.bands, 'getAsync').mockImplementationOnce(async (...args: Parameters<DatasetBands['getAsync']>) => {
          const band = await dataset.bands.getAsync(...args);
          vi.spyOn(band, 'noDataValueAsync', 'get').mockImplementationOnce(async () => {
            return Promise.reject(error);
          });
          return band;
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when srs cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access srs';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset, 'srsAsync', 'get').mockImplementationOnce(async () => {
          return Promise.reject(error);
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when srs authority code cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access srs authority code';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.SpatialReference.prototype, 'getAuthorityCode').mockImplementationOnce(() => {
        throw error;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when is geographic srs check throws an error', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access is geographic srs';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.SpatialReference.prototype, 'isGeographic').mockImplementationOnce(() => {
        throw error;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when is projected srs check throws an error', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access is projected srs';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.SpatialReference.prototype, 'isProjected').mockImplementationOnce(() => {
        throw error;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when srs attribute cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access srs attribute';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.SpatialReference.prototype, 'getAttrValue').mockImplementationOnce(() => {
        throw error;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when geo transform cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access geo transform';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.Driver.prototype, 'openAsync').mockImplementationOnce(async (...args: Parameters<Driver['openAsync']>) => {
        const dataset = await gdalAsync.drivers.get(metadata.driverName).openAsync(...args);
        vi.spyOn(dataset, 'geoTransformAsync', 'get').mockImplementationOnce(async () => {
          return Promise.reject(error);
        });
        return dataset;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });

    it('should return 500 status code and respond with unsuccessful message when bands envelope cannot be accessed', async () => {
      const metadata = createInfoMetadata({ demType: 'geotiff' });
      const demFilePath = await createInfoResource(metadata);
      const expectedErrorMessage = 'cannot access bands envelope';
      const error = new Error(expectedErrorMessage);
      vi.spyOn(gdalAsync.DatasetBands.prototype, 'getEnvelope').mockImplementationOnce(() => {
        throw error;
      });

      const response = await requestSender.info({ requestBody: demFilePath });

      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
      expect(response).toSatisfyApiSpec();
      expect((response.body as InfoResponseBodyInternalServerError).message).toBe(expectedErrorMessage);
      expect.assertions(3);
    });
  });
});
