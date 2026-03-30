import type { z } from 'zod';
import type { components } from '@src/openapi';
import type { RASTER_DATA_TYPES } from './constants';
import type { pixelDataTypesSchema } from './schemas';

export type NoDuplicates<T extends unknown[]> = T extends [infer First, ...infer Rest]
  ? First extends Rest[number]
    ? false
    : NoDuplicates<Rest>
  : true;

export type IsComplete<U extends unknown[], Target> = [Target] extends [U[number]] ? true : false;

export type GeoTiffDataType = components['schemas']['InfoGeoTiff']['dataType'];
export type RasterDataType = components['schemas']['InfoResponse']['dataType'];

export type PixelDataType = z.infer<ReturnType<typeof pixelDataTypesSchema>>;
export type RasterFormats = keyof typeof RASTER_DATA_TYPES;
