import epsg from 'epsg-index/all.json';
import { epsgRecordsSchema } from './schemas';

export const EPSG_DATA_RECORDS = epsgRecordsSchema.parse(epsg);
