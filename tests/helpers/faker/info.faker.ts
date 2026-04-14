import { z } from 'zod';
import { fake } from 'zod-schema-faker/v4';
import type { RASTER_DATA_TYPES } from '@src/common/constants';
import {
  areaOrPointSchema,
  noDataValueSchema,
  pixelDataTypesSchema,
  resolutionDegreeSchema,
  resolutionMeterSchema,
  srsIdSchema,
  srsNameSchema,
} from '@src/common/schemas';
import { createGDALGeotiffCOGRaster, type CreateGDALRasterOptions } from '../generators/gdal';
import type { DemType, InfoRequestBody, InfoResponse } from '../interfaces';
import { createGDALRasterMetadata } from './rasterMetadata.faker';

export const createInfoMetadata = (options: DemType): CreateGDALRasterOptions => {
  const { demType } = options;

  const rasterMetadata = createGDALRasterMetadata({ demType });
  return rasterMetadata;
};

export const createInfoResource = async (options: CreateGDALRasterOptions): Promise<Pick<InfoRequestBody, 'demFilePath'>> => {
  let demFilePath: string;
  switch (options.driverName) {
    case 'gtiff': {
      demFilePath = await createGDALGeotiffCOGRaster(options);
      break;
    }
    default: {
      throw new Error(`Unsupported driver '${options.driverName}' for info resource creation`);
    }
  }
  return { demFilePath };
};

export const generateInfoResponse = (format: keyof typeof RASTER_DATA_TYPES): InfoResponse => {
  const infoResponseSchema = z.strictObject({
    areaOrPoint: areaOrPointSchema,
    resolutionDegree: resolutionDegreeSchema,
    resolutionMeter: resolutionMeterSchema,
    srsId: srsIdSchema,
    srsName: srsNameSchema,
    dataType: pixelDataTypesSchema(format),
    noDataValue: noDataValueSchema,
  });
  return fake(infoResponseSchema);
};
