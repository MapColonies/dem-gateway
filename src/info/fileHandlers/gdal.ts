import { access, constants } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Driver, drivers, openAsync, SpatialReference, type Dataset } from 'gdal-async';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import type { ConfigType } from '@src/common/config';
import { SERVICES } from '@src/common/constants';
import { getPixelInfo, getResolutions, getSrsInfo } from '@src/common/gdal';
import { areaOrPointSchema, noDataValueSchema, pixelDataTypesSchema } from '@src/common/schemas';
import type { FileHandler, InfoResponse } from '@src/info/models/infoManager';

@injectable()
export class GDALHandler implements FileHandler {
  private readonly defaultGeographicSrs: SpatialReference;
  private readonly defaultProjectedSrs: SpatialReference;
  private readonly supportedFormatsMap: Record<string, string>;
  private readonly sourceDir: string;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {
    this.defaultGeographicSrs = SpatialReference.fromEPSG(this.config.get('application.defaultGeographicSrsId') as unknown as number);
    this.defaultProjectedSrs = SpatialReference.fromEPSG(this.config.get('application.defaultProjectedSrsId') as unknown as number);
    this.supportedFormatsMap = this.config.get('application.supportedFormatsMap') as unknown as Record<string, string>;
    this.sourceDir = this.config.get('storageExplorer.sourceDir') as unknown as string;
  }

  public supports(filePath: string): boolean {
    try {
      this.getDriver(filePath);
      return true;
    } catch (error) {
      this.logger.debug(error);
      return false;
    }
  }

  public async getInfo(filePath: string): Promise<InfoResponse> {
    this.logger.info(`getting info for ${filePath}`);
    let dataset: Dataset | undefined;

    const fullFilePath = join(this.sourceDir, filePath);
    try {
      await access(fullFilePath, constants.F_OK);
    } catch (error) {
      throw new NotFoundError(`Cannot find file: ${fullFilePath}. got error: ${JSON.stringify(error)}`);
    }
    try {
      const dataset = await openAsync(fullFilePath, 'r');

      const driverName = dataset.driver.description.toLowerCase();
      const supportedFormat = Object.entries(this.supportedFormatsMap).find(([, value]) => value === driverName)?.[0];
      if (supportedFormat === undefined) throw new Error('Unsupported DEM format');

      const areaOrPoint = z
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .object({ AREA_OR_POINT: areaOrPointSchema }, { error: 'Could not extract AREA_OR_POINT metadata' })
        .parse(await dataset.getMetadataAsync()).AREA_OR_POINT;

      const band = await dataset.bands.getAsync(1); // DEMs are mostly single banded

      const dataType = pixelDataTypesSchema.parse(await band.dataTypeAsync);

      const noDataValue = noDataValueSchema.parse(await band.noDataValueAsync);

      const srs = await dataset.srsAsync;
      if (srs === null) throw new Error('Unsupported SRS');

      const { srsId, srsName } = getSrsInfo(srs);

      const geoTransform = await dataset.geoTransformAsync;

      const { resolutionDegrees, resolutionMeter } = getResolutions({
        ...dataset.bands.getEnvelope(),
        ...getPixelInfo({ geoTransform }),
        targetGeographicSrs: this.defaultGeographicSrs,
        targetProjectedSrs: this.defaultProjectedSrs,
        sourceSrs: srs,
      });

      return {
        areaOrPoint,
        dataType,
        noDataValue,
        resolutionDegrees,
        resolutionMeter,
        srsId,
        srsName,
      };
    } finally {
      dataset?.close();
    }
  }

  private getDriver(filePath: string): Driver {
    const fileExtension = extname(filePath).slice(1);
    const supportedDriver = Object.values(this.supportedFormatsMap).find((supportedDriver) => {
      const driver = drivers.get(supportedDriver);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const driverMetadata = driver.getMetadata() as { DMD_EXTENSION?: string; DMD_EXTENSIONS?: string };
      const { DMD_EXTENSION: extension = '', DMD_EXTENSIONS: extensions = '' } = driverMetadata;
      return [extension, ...extensions.split(' ')].filter((extension) => extension.length > 0).includes(fileExtension);
    });

    if (supportedDriver === undefined) throw new Error(`Unsupported file format of file: ${filePath}`);
    return drivers.get(supportedDriver);
  }
}
