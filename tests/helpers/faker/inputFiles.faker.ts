import { merge } from 'lodash';
import { fake } from 'zod-schema-faker/v4';
import { z } from 'zod/v4';
import type { paths } from '@openapi';

// TODO: get schema from dem-shared
const demFilePathSchema = z.strictObject({
  demFilePath: z.string().regex(new RegExp('^(\\/?[\\w-]+)(\\/[\\w-]+)*\\/[\\wא-ת\\.-]+\\.(tif)$')), // TODO: extract regex pattern to dem-shared
});

export type DemFilePath = Pick<paths['/info']['post']['requestBody']['content']['application/json'], 'demFilePath'>;

export const createDemFilePath = (overrides: Partial<DemFilePath> = {}): DemFilePath => {
  const demFilePath = fake(demFilePathSchema) satisfies DemFilePath;

  return merge(demFilePath, overrides);
};
