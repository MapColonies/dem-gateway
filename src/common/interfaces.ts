import type { z } from 'zod';
import type { components } from '@src/openapi';
import type { pixelDataTypesSchema } from './schemas';

export type NoDuplicates<T extends unknown[]> = T extends [infer First, ...infer Rest]
  ? First extends Rest[number]
    ? false
    : NoDuplicates<Rest>
  : true;

export type IsComplete<U extends unknown[], Target> = [Target] extends [U[number]] ? true : false;

export type GeoTiffDataType = components['schemas']['InfoGeoTiff']['dataType'];
export type RasterDataType = components['schemas']['InfoResponse']['dataType'];

export type PixelDataType = z.infer<typeof pixelDataTypesSchema>;
