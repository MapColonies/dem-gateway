import { z } from 'zod';
import { getConfig } from './config';
import { GEOTIFF_DATA_TYPES } from './constants';

const config = getConfig();

const supportedSrsIds = config.get('application.supportedSrsIds') as unknown as number[]; // TODO: include application.supportedSrsIds in service schema

export const areaOrPointSchema = z.literal(['Area', 'Point']);
export const noDataValueSchema = z.union([z.number(), z.nan()]).transform((value) => (Number.isNaN(value) ? 'NaN' : value));
export const pixelDataTypesSchema = z.union([z.literal(GEOTIFF_DATA_TYPES)]); // add additional data types to union for each supported format
export const pixelSchema = z.number().positive();
export const srsIdSchema = z.literal(supportedSrsIds);
export const srsNameSchema = z.string().min(1);

export const epsgRecordSchema = z.strictObject({
  code: z.string(),
  kind: z.string(),
  name: z.string(),
  wkt: z.string().nullable(),
  proj4: z.string().nullable(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  unit: z.string().nullable(),
  area: z.string().nullable(),
  accuracy: z.number().nullable(),
});
export const epsgRecordsSchema = z.record(z.coerce.number().int().positive(), epsgRecordSchema);
