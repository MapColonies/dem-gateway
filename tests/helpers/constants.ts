import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SERVICE_NAME } from '@src/common/constants';

export const tmpDirPath = join(tmpdir(), SERVICE_NAME);
