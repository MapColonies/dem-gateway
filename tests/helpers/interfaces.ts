import type { RasterFormats } from '@src/common/interfaces';
import type { components, paths } from '@src/openapi';

export type InfoGeoTiff = components['schemas']['InfoGeoTiff'];
export type InfoResponse = paths['/info']['post']['responses']['200']['content']['application/json'];
export type InfoRequestBody = paths['/info']['post']['requestBody']['content']['application/json'];

export interface DemType {
  demType: RasterFormats;
}
