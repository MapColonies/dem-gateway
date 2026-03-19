import { z } from 'zod';
import { getConfig } from './config';
import { GEOTIFF_DATA_TYPES } from './constants';

const config = getConfig();

const blockSize = config.get('application.validation.blockSize');
const compression = config.get('application.validation.compression');
const resolutionDegree = config.get('application.validation.resolutionDegree');
const resolutionMeter = config.get('application.validation.resolutionMeter');
const supportedSrsIds = config.get('application.validation.supportedSrsIds');

export const areaOrPointSchema = z.literal(['Area', 'Point']);
export const blockSizeSchema = z.object({ x: z.literal(blockSize), y: z.literal(blockSize) });
export const compressionSchema = z.literal(compression);
export const layoutSchema = z.literal('COG');
export const noDataValueSchema = z.union([z.number(), z.nan()]).transform((value) => (Number.isNaN(value) ? 'NaN' : value));
export const overviewsCount = z.number().positive();
export const pixelDataTypesSchema = z.union([z.literal(GEOTIFF_DATA_TYPES)]); // add additional data types to union for each supported format
export const pixelSchema = z.number().positive();
export const resolutionDegreeSchema = z.number().min(resolutionDegree.min).max(resolutionDegree.max);
export const resolutionMeterSchema = z.number().min(resolutionMeter.min).max(resolutionMeter.max);
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
