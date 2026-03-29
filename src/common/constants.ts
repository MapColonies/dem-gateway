import { readPackageJsonSync } from '@map-colonies/read-pkg';
import type { GeoTiffDataType, IsComplete, NoDuplicates, RasterDataType } from './interfaces';

const defineConstTuple =
  <T>() =>
  <U extends T[]>(
    ...args: U &
      (NoDuplicates<U> extends false ? 'Error: Duplicate value found' : IsComplete<U, T> extends false ? 'Error: Missing values from the union' : U)
  ): U =>
    args;

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';
export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METRICS: Symbol('METRICS'),
} satisfies Record<string, symbol>;
/* eslint-enable @typescript-eslint/naming-convention */

export const GEOTIFF_DATA_TYPES = defineConstTuple<GeoTiffDataType>()('Int8', 'Int16', 'Int32', 'Int64', 'Float16', 'Float32', 'Float64');
export const RASTER_DATA_TYPES: Record<string, RasterDataType[]> = {
  geotiff: GEOTIFF_DATA_TYPES,
};
