import { z, type ZodLiteral, type ZodNumber } from 'zod';
import { getConfig } from './config';
import { RASTER_DATA_TYPES } from './constants';

const config = getConfig();

const blockSize = config.get('application.validation.blockSize');
const compression = config.get('application.validation.compression');
const resolutionDegree = config.get('application.validation.resolutionDegree');
const resolutionMeter = config.get('application.validation.resolutionMeter');
const supportedSrsIds = config.get('application.validation.supportedSrsIds');

export const hasKey = <T extends Record<PropertyKey, unknown>>(x: PropertyKey, object: T): x is keyof T => {
  return Object.keys(object).includes(String(x));
};

export const areaOrPointSchema = z.literal(['Area', 'Point']);
export const blockSizeSchema = z.object({ x: z.literal(blockSize), y: z.literal(blockSize) });
export const compressionSchema = z.literal(compression);
export const layoutSchema = z.literal('COG');
export const noDataValueSchema = z.union([z.number(), z.nan()]).transform((value) => (Number.isNaN(value) ? 'NaN' : value));
export const overviewsCountSchema = ({
  blockSize,
  size: { x, y },
}: {
  blockSize: z.infer<typeof blockSizeSchema>;
  size: { x: number; y: number };
}): ZodNumber =>
  z
    .number()
    .min(1)
    .max(Math.min(...[Math.ceil(x / blockSize.x), Math.ceil(y / blockSize.y)]))
    .int()
    .positive();
export const pixelDataTypesSchema = (
  format: keyof typeof RASTER_DATA_TYPES
): ZodLiteral<(typeof RASTER_DATA_TYPES)[keyof typeof RASTER_DATA_TYPES][number]> => z.literal(RASTER_DATA_TYPES[format]);
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
