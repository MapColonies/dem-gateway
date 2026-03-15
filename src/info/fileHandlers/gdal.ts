import { access, constants } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { Dataset, Driver, SpatialReference } from 'gdal-async';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import type { ConfigType } from '@src/common/config';
import { SERVICES } from '@src/common/constants';
import { GDAL_ASYNC, getPixelInfo, getResolutions, getSrsInfo, type GdalAsync } from '@src/common/gdal';
import { areaOrPointSchema, noDataValueSchema, pixelDataTypesSchema, srsIdSchema, srsNameSchema } from '@src/common/schemas';
import type { FileHandler, InfoResponse } from '@src/info/models/infoManager';

@injectable()
export class GDALHandler implements FileHandler {
  private readonly defaultGeographicSrs: SpatialReference;
  private readonly defaultProjectedSrs: SpatialReference;
  private readonly supportedFormatsMap: Record<string, string>;
  private readonly sourceDir: string;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(GDAL_ASYNC) private readonly gdal: GdalAsync
  ) {
    this.defaultGeographicSrs = this.gdal.SpatialReference.fromEPSG(this.config.get('application.defaultGeographicSrsId') as unknown as number);
    this.defaultProjectedSrs = this.gdal.SpatialReference.fromEPSG(this.config.get('application.defaultProjectedSrsId') as unknown as number);
    this.supportedFormatsMap = this.config.get('application.supportedFormatsMap') as unknown as Record<string, string>;
    this.sourceDir = this.config.get('storageExplorer.sourceDir') as unknown as string;
  }

  public supports(filePath: string): boolean {
    try {
      this.getDriver(filePath);
      this.logger.debug({ msg: `Handler '${GDALHandler.name}' supports the requested file` });
      return true;
    } catch (error) {
      this.logger.debug({ msg: `Handler '${GDALHandler.name}' cannot handle the requested file, caused by an error: ${JSON.stringify(error)}` });
      return false;
    }
  }

  public async getInfo(filePath: string): Promise<InfoResponse> {
    this.logger.info({ msg: `Getting info for ${filePath}` });
    let dataset: Dataset | undefined;

    const fullFilePath = join(this.sourceDir, filePath);
    try {
      await access(fullFilePath, constants.F_OK);
    } catch (error) {
      this.logger.error({ msg: `Cannot find file: ${fullFilePath}`, err: error });
      throw new NotFoundError(`Cannot find file: ${fullFilePath}. got error: ${JSON.stringify(error)}`);
    }

    try {
      const driver = this.getDriver(filePath);
      const dataset = await driver.openAsync(fullFilePath, 'r');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const metadata = await dataset.getMetadataAsync();
      const areaOrPoint = z
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .strictObject({ AREA_OR_POINT: areaOrPointSchema })
        .parse(metadata, { error: () => 'Could not extract AREA_OR_POINT metadata' }).AREA_OR_POINT;

      const band = await dataset.bands.getAsync(1); // DEMs are mostly single banded

      const bandDataType = await band.dataTypeAsync;
      const dataType = pixelDataTypesSchema.parse(bandDataType, { error: () => 'Unsupported band data type' });

      const bandNoDataValueAsync = await band.noDataValueAsync;
      const noDataValue = noDataValueSchema.parse(bandNoDataValueAsync, { error: () => 'Unsupported band nodata value' });

      const srs = await dataset.srsAsync;
      if (srs === null) throw new Error('Unsupported SRS');
      const srsInfo = getSrsInfo(srs);
      const { srsId, srsName } = z.strictObject({ srsId: srsIdSchema, srsName: srsNameSchema }).parse(srsInfo, { error: () => 'Unsupported SRS' });

      const geoTransform = await dataset.geoTransformAsync;

      const { resolutionDegree, resolutionMeter } = getResolutions({
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
        resolutionDegree,
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
      const driver = this.gdal.drivers.get(supportedDriver);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const driverMetadata = driver.getMetadata() as { DMD_EXTENSION?: string; DMD_EXTENSIONS?: string };
      const { DMD_EXTENSION: extension = '', DMD_EXTENSIONS: extensions = '' } = driverMetadata;
      return [extension, ...extensions.split(' ')].filter((extension) => extension.length > 0).includes(fileExtension);
    });

    if (supportedDriver === undefined) throw new Error(`Unsupported file format of file: ${filePath}`);
    return this.gdal.drivers.get(supportedDriver);
  }
}
