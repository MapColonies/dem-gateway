import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpDirPath } from '@tests/helpers/constants';

export default function setup() {
  if (!existsSync(tmpDirPath)) mkdirSync(tmpDirPath);

  return function teardown(): void {
    rmSync(tmpDirPath, { recursive: true, force: true });
  };
}
