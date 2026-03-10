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
