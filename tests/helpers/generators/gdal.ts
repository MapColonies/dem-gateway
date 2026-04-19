/* eslint-disable @typescript-eslint/naming-convention */
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { drivers, SpatialReference, type StringOptions } from 'gdal-async';
import type { z } from 'zod';
import type { blockSizeSchema, compressionSchema, layoutSchema, overviewsCountSchema } from '@src/common/schemas';
import { tmpDirPath } from '../constants';
import type { InfoGeoTiff } from '../interfaces';

interface GDALCreationOptions {
  driverName: string;
  xSize: number;
  ySize: number;
  blockSize: z.infer<typeof blockSizeSchema>['x'];
  compression: z.infer<typeof compressionSchema>;
  layout: z.infer<typeof layoutSchema>;
  overviewsCount: z.infer<ReturnType<typeof overviewsCountSchema>>;
  creationOptions?: StringOptions;
}

const BAND_COUNT = 1;

export type CreateGDALRasterOptions = GDALCreationOptions &
  Omit<InfoGeoTiff, 'noDataValue'> & {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    noDataValue: number | 'NaN'; // NaN is provided as string literal since JSON response cannot encode NaN numberically
    pixelWidth: number;
    pixelHeight: number;
  };

/**
 * @returns Path to the COG geotiff
 */
export const createGDALGeotiffCOGRaster = async (options: CreateGDALRasterOptions): Promise<string> => {
  const {
    areaOrPoint,
    blockSize,
    compression,
    dataType,
    layout,
    maxY,
    minX,
    noDataValue,
    overviewsCount,
    pixelHeight,
    pixelWidth,
    srsId,
    creationOptions = {},
    xSize,
    ySize,
  } = options;

  const driverGeoTiff = drivers.get('MEM');
  const filePath = join(tmpDirPath, faker.system.commonFileName('tif'));

  const dataset = await driverGeoTiff.createAsync('', xSize, ySize, BAND_COUNT, dataType, creationOptions);

  const srs = SpatialReference.fromEPSG(srsId);
  dataset.srs = srs;
  dataset.geoTransform = [minX, pixelWidth, 0, maxY, 0, -pixelHeight];
  dataset.bands.forEach((band) => {
    band.noDataValue = Number(noDataValue);
  });
  dataset.setMetadata({ AREA_OR_POINT: areaOrPoint });
  await dataset.buildOverviewsAsync('NEAREST', [overviewsCount]);

  const cogDriver = drivers.get('COG');
  const cogOptions = { LAYOUT: layout, COMPRESS: compression, BLOCKSIZE: blockSize };

  const finalDs = await cogDriver.createCopyAsync(filePath, dataset, cogOptions, false);
  finalDs.close();
  dataset.close();
  return filePath;
};
