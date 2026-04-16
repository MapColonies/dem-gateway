import * as fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { NotFoundError } from '@map-colonies/error-types';
import { jsLogger } from '@map-colonies/js-logger';
import {
  CoordinateTransformation,
  SpatialReference,
  type Dataset,
  type DatasetBands,
  type Driver,
  type GDALDrivers,
  type RasterBand,
  type RasterBandOverviews,
  type xyz,
} from 'gdal-async';
import { afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { getConfig } from '@src/common/config';
import { type GdalAsync, getPixelInfo, getResolutions, getSrsInfo } from '@src/common/gdal';
import { GDALHandler } from '@src/info/fileHandlers/gdal';
import { hasKey } from '@src/common/utils';

const config = getConfig();
const { max: resolutionDegreeMax, min: resolutionDegreeMin } = config.get('application.validation.resolutionDegree');
const { max: resolutionMeterMax, min: resolutionMeterMin } = config.get('application.validation.resolutionMeter');
const blockSize = config.get('application.validation.blockSize');

const mockClose = vi.fn<() => void>();
const mockGeoTransform = vi.fn<() => Promise<number[]>>();
const mockSrsAsync = vi.fn<() => Dataset['srsAsync']>();
const mockBlockSize = vi.fn<() => Promise<xyz>>();
const mockDataType = vi.fn<() => Promise<string>>();
const mockNoDataValue = vi.fn<() => Promise<number>>();
const mockTransformPoint = vi.fn().mockReturnValue({ x: 100, y: 100, z: 0 });

vi.mock('node:fs/promises');
vi.mock('@src/common/gdal');
vi.mock('@src/common/utils');

const mockAccess = vi.mocked(fsPromises.access).mockResolvedValue(undefined);
const mockGetSrsInfo = vi.mocked(getSrsInfo).mockReturnValue({ srsId: 4326, srsName: 'WGS 84' });
const mockGetPixelInfo = vi.mocked(getPixelInfo).mockReturnValue({ pixelHeight: 0.01, pixelWidth: 0.01 });
const mockGetResolutions = vi.mocked(getResolutions).mockReturnValue({ resolutionDegree: 0.01, resolutionMeter: 9999 });
const mockHasKey = vi.mocked(hasKey).mockReturnValue(true);

const mockOverview = {
  countAsync: vi.fn().mockReturnValue(1),
} satisfies Partial<RasterBandOverviews> as unknown as Mocked<RasterBandOverviews>;
const mockBand = {
  get blockSizeAsync(): Promise<xyz> {
    return mockBlockSize.mockImplementation(async () => Promise.resolve({ x: blockSize, y: blockSize }))();
  },
  get dataTypeAsync(): Promise<string> {
    return mockDataType.mockImplementation(async () => Promise.resolve('Int16'))();
  },
  get noDataValueAsync(): Promise<number> {
    return mockNoDataValue.mockImplementation(async () => Promise.resolve(-9999))();
  },
  overviews: mockOverview,
  size: { x: blockSize * 2, y: blockSize * 2 },
} satisfies Partial<RasterBand> as unknown as Mocked<RasterBand>;
const mockBands = {
  getAsync: vi.fn().mockResolvedValue(mockBand),
  getEnvelope: vi.fn().mockReturnValue({
    minX: 0,
    minY: 0,
    maxX: 100,
    maxY: 100,
  }),
} satisfies Partial<DatasetBands> as unknown as Mocked<DatasetBands>;
const mockCoordinateTransformation = {
  transformPoint: vi.fn().mockImplementation(() => {}),
} satisfies Partial<CoordinateTransformation> as unknown as Mocked<CoordinateTransformation>;
const mockSpatialReference = {
  isGeographic: vi.fn().mockReturnValue(true),
  isProjected: vi.fn().mockReturnValue(false),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  EPSGTreatsAsLatLong: vi.fn().mockReturnValue(false),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  EPSGTreatsAsNorthingEasting: vi.fn().mockReturnValue(false),
  getAuthorityCode: vi.fn().mockReturnValue('4326'),
  getAttrValue: vi.fn().mockReturnValue('WGS 84'),
} satisfies Partial<SpatialReference> as unknown as Mocked<SpatialReference>;
const mockDataset = {
  getMetadataAsync: vi.fn<Dataset['getMetadataAsync']>().mockImplementation(async (...args: Parameters<Dataset['getMetadataAsync']>) => {
    const domain = args[0];
    const resposnse = await Promise.resolve(
      domain === 'IMAGE_STRUCTURE'
        ? {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            LAYOUT: 'COG',
            // eslint-disable-next-line @typescript-eslint/naming-convention
            COMPRESSION: 'LZW',
          }
        : {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            AREA_OR_POINT: 'Area',
          }
    );
    return resposnse;
  }),
  bands: mockBands,
  get srsAsync() {
    return mockSrsAsync.mockImplementation(async () => Promise.resolve(mockSpatialReference))();
  },
  get geoTransformAsync() {
    return mockGeoTransform.mockImplementation(async () => Promise.resolve([0, 0.01, 0, 0, 0, -0.01]))();
  },
  close: mockClose.mockImplementation(() => {}),
} satisfies Partial<Dataset> as unknown as Mocked<Dataset>;
const mockDriver = {
  getMetadata: vi.fn().mockReturnValue({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    DMD_EXTENSION: 'tif',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    DMD_EXTENSIONS: 'tiff tif',
  }),
  openAsync: vi.fn().mockResolvedValue(mockDataset),
} satisfies Partial<Driver> as unknown as Mocked<Driver>;
const mockDrivers = {
  get: vi.fn().mockReturnValue(mockDriver),
} satisfies Partial<GDALDrivers> as unknown as Mocked<GDALDrivers>;
const mockGdal = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  CoordinateTransformation: vi.fn<typeof CoordinateTransformation>().mockImplementation(() => mockCoordinateTransformation),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  SpatialReference: vi.fn<typeof SpatialReference>().mockImplementation(() => mockSpatialReference),
  drivers: mockDrivers,
} satisfies Partial<GdalAsync> as unknown as Mocked<GdalAsync>;

describe('GDALHandler', () => {
  let gdalHandler: GDALHandler;
  const filePath = join('/path/to/', faker.system.commonFileName('tif'));

  beforeEach(async () => {
    gdalHandler = new GDALHandler(config, await jsLogger({ enabled: false }), mockGdal);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('#supports', () => {
    it('should return true when input file is supported by config and gdal driver', () => {
      const response = gdalHandler.supports(filePath);

      expect(response).toBe(true);
    });

    it('should return false when a configured driver is not accessible', () => {
      const error = new Error('Driver not accessible');
      mockDrivers.get.mockImplementationOnce(() => {
        throw error;
      });

      const response = gdalHandler.supports(filePath);

      expect(response).toBe(false);
    });

    it('should return false when input file is not supported by config', () => {
      const response = gdalHandler.supports(faker.system.commonFileName('bad_file_extension'));

      expect(response).toBe(false);
    });

    it('should return false when input file format is not supported by the API', () => {
      mockHasKey.mockReturnValueOnce(false);
      const response = gdalHandler.supports(filePath);

      expect(response).toBe(false);
    });

    it('should return false when configured driver is not accessible', () => {
      const error = new Error('Driver not accessible');
      mockDrivers.get.mockImplementationOnce(() => {
        throw error;
      });

      const response = gdalHandler.supports(filePath);

      expect(response).toBe(false);
    });

    it('should return false when configured driver metadata is not accessible', () => {
      const error = new Error('Driver metadata not accessible');
      mockDriver.getMetadata.mockImplementationOnce(() => {
        throw error;
      });

      const response = gdalHandler.supports(filePath);

      expect(response).toBe(false);
    });

    it('should return false when input file is not supported by any gdal driver', () => {
      mockDriver.getMetadata.mockReturnValueOnce({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        DMD_EXTENSION: 'tiff',
      });

      const response = gdalHandler.supports(filePath);

      expect(response).toBe(false);
    });
  });

  describe('#getInfo', () => {
    it('should successfully return info response for a supported file', async () => {
      mockTransformPoint.mockReturnValueOnce({ x: 50, y: 50, z: 0 });
      mockTransformPoint.mockReturnValueOnce({ x: 100, y: 100, z: 0 });

      const response = await gdalHandler.getInfo(filePath);

      expect(response).toBeObject();
      expect(response.areaOrPoint).toBe('Area');
      expect(response.dataType).toBe('Int16');
      expect(response.noDataValue).toBe(-9999);
      expect(response.srsId).toBe(4326);
      expect(response.srsName).toBe('WGS 84');
      expect(response.resolutionMeter).toBeWithin(resolutionMeterMin, resolutionMeterMax);
      expect(response.resolutionDegree).toBeWithin(resolutionDegreeMin, resolutionDegreeMax);
      expect(mockClose).toHaveBeenCalled();
      expect.assertions(9);
    });

    it('should raise an error when file does not exist', async () => {
      const accessError = new Error('File not found');
      mockAccess.mockRejectedValueOnce(accessError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(NotFoundError);
      expect.assertions(1);
    });

    it('should raise an error when configured driver is not accessible', async () => {
      const expectedError = new Error('Driver not accessible');
      mockDrivers.get.mockImplementationOnce(() => {
        throw expectedError;
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file is not supported by config', async () => {
      const response = gdalHandler.getInfo(faker.system.commonFileName('bad_file_extension'));

      await expect(response).rejects.toThrow('Unsupported file format');
      expect.assertions(1);
    });

    it('should raise an error when configured driver metadata is not accessible', async () => {
      const expectedError = new Error('Driver metadata not accessible');
      mockDriver.getMetadata.mockImplementationOnce(() => {
        throw expectedError;
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file is not supported by any gdal driver', async () => {
      mockDriver.getMetadata.mockReturnValueOnce({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        DMD_EXTENSION: 'tiff',
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(`Unsupported file format of file: ${filePath}`);
      expect.assertions(1);
    });

    it('should raise an error when input file cannot be opened gdal driver', async () => {
      const expectedError = new Error('File open failed');
      mockDriver.openAsync.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file band is not accessible', async () => {
      const expectedError = new Error('Band not accessible');
      mockBands.getAsync.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file metadata of image structure is not accessible', async () => {
      const expectedError = new Error('Metadata of image structure not accessible');
      mockDataset.getMetadataAsync.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file metadata of image structure is not valid', async () => {
      mockDataset.getMetadataAsync.mockResolvedValueOnce({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        LAYOUT: '',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        COMPRESSION: 'LZW',
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Unsupported image structure metadata (LAYOUT and COMPRESSION)');
      expect.assertions(1);
    });

    it('should raise an error when input file band block size is not accessible', async () => {
      const expectedError = new Error('Block size not accessible');
      mockBlockSize.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file band block size is not valid', async () => {
      mockBlockSize.mockResolvedValueOnce({ x: 0, y: 0 });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Unsupported block size');
      expect.assertions(1);
    });

    it('should raise an error when input file band overviews count is not accessible', async () => {
      const expectedError = new Error('Overviews count not accessible');
      mockOverview.countAsync.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file file band overviews count is not valid', async () => {
      mockOverview.countAsync.mockResolvedValueOnce(0);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Could not find overviews');
      expect.assertions(1);
    });

    it('should raise an error when input file metadata is not accessible', async () => {
      const expectedError = new Error('Metadata not accessible');
      mockDataset.getMetadataAsync
        .mockResolvedValueOnce({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          LAYOUT: 'COG',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          COMPRESSION: 'LZW',
        })
        .mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file metadata is not valid', async () => {
      mockDataset.getMetadataAsync
        .mockResolvedValueOnce({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          LAYOUT: 'COG',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          COMPRESSION: 'LZW',
        })
        .mockResolvedValueOnce({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          AREA_OR_POINT: '',
        });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Could not extract AREA_OR_POINT metadata');
      expect.assertions(1);
    });

    it('should raise an error when input file band data type is not accessible', async () => {
      const expectedError = new Error('Data type not accessible');
      mockDataType.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file band data type is not valid', async () => {
      mockDataType.mockResolvedValueOnce('InvalidType');

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Unsupported band data type');
      expect.assertions(1);
    });

    it('should raise an error when input file band nodata value is not accessible', async () => {
      const expectedError = new Error('nodata value error');
      mockNoDataValue.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file band nodata value is not valid', async () => {
      mockNoDataValue.mockResolvedValueOnce(Infinity);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Unsupported band nodata value');
      expect.assertions(1);
    });

    it('should raise an error when input file srs is not accessible', async () => {
      const expectedError = new Error('Band not accessible');
      mockSrsAsync.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file srs is not defined', async () => {
      mockSrsAsync.mockResolvedValueOnce(null);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Unsupported SRS');
      expect.assertions(1);
    });

    it('should raise an error when input file srs info extraction is not valid - invalid srs id', async () => {
      mockGetSrsInfo.mockReturnValueOnce({
        srsId: 0,
        srsName: 'name',
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Unsupported SRS');
      expect.assertions(1);
    });

    it('should raise an error when input file srs info extraction is not valid - invalid srs name', async () => {
      mockGetSrsInfo.mockReturnValueOnce({
        srsId: 4326,
        srsName: '',
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow('Unsupported SRS');
      expect.assertions(1);
    });

    it('should raise an error when input file srs info extraction throws an error', async () => {
      const expectedError = 'srs info error';
      mockGetSrsInfo.mockImplementationOnce(() => {
        throw new Error(expectedError);
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file geo transform is not accessible', async () => {
      const expectedError = new Error('Geo transform not accessible');
      mockGeoTransform.mockRejectedValueOnce(expectedError);

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file pixel info extraction throws an error', async () => {
      const expectedError = 'pixel info error';
      mockGetPixelInfo.mockImplementationOnce(() => {
        throw new Error(expectedError);
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file bands envelope is not accessible', async () => {
      const expectedError = new Error('Envelope not accessible');
      mockBands.getEnvelope.mockImplementationOnce(() => {
        throw expectedError;
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });

    it('should raise an error when input file resolution extraction throws an error', async () => {
      const expectedError = 'resolutions error';
      mockGetResolutions.mockImplementationOnce(() => {
        throw new Error(expectedError);
      });

      const response = gdalHandler.getInfo(filePath);

      await expect(response).rejects.toThrow(expectedError);
      expect.assertions(1);
    });
  });
});
