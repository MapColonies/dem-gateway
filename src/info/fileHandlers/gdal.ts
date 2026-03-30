import { access, constants } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { SpatialReference, type Dataset, type Driver, type RasterBand } from 'gdal-async';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import type { ConfigType } from '@src/common/config';
import { RASTER_DATA_TYPES, SERVICES } from '@src/common/constants';
import { GDAL_ASYNC, getPixelInfo, getResolutions, getSrsInfo, type GdalAsync } from '@src/common/gdal';
import { enrichLogContext } from '@src/common/logger';
import {
  areaOrPointSchema,
  blockSizeSchema,
  compressionSchema,
  hasKey,
  layoutSchema,
  noDataValueSchema,
  overviewsCount,
  pixelDataTypesSchema,
  srsIdSchema,
  srsNameSchema,
} from '@src/common/schemas';
import type { FileHandler, InfoResponse } from '@src/info/models/infoManager';
import type { RasterFormats } from '@src/common/interfaces';

@injectable()
export class GDALHandler implements FileHandler {
  public readonly name = GDALHandler.name;
  private readonly defaultGeographicSrs: SpatialReference;
  private readonly defaultProjectedSrs: SpatialReference;
  private readonly supportedFormatsMap: Record<string, string>;
  private readonly sourceDir: string;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(GDAL_ASYNC) private readonly gdal: GdalAsync
  ) {
    this.defaultGeographicSrs = SpatialReference.fromEPSG(this.config.get('application.defaultGeographicSrsId'));
    this.defaultProjectedSrs = SpatialReference.fromEPSG(this.config.get('application.defaultProjectedSrsId'));
    this.supportedFormatsMap = this.config.get('application.supportedFormatsMap');
    this.sourceDir = this.config.get('storageExplorer.sourceDir');
  }

  public supports(filePath: string): boolean {
    try {
      this.logger.debug({ msg: 'Check if file is supported by handler' });
      this.getDriver(filePath);
      this.logger.debug({ msg: `Handler '${this.name}' supports the requested file` });
      return true;
    } catch (error) {
      this.logger.debug({ msg: `Handler '${this.name}' cannot handle the requested file, caused by an error: ${JSON.stringify(error)}` });
      return false;
    }
  }

  public async getInfo(filePath: string): Promise<InfoResponse> {
    enrichLogContext({ handler: this.name });
    this.logger.debug({ msg: 'Getting info' });
    let dataset: Dataset | undefined;

    const fullFilePath = join(this.sourceDir, filePath);
    try {
      await access(fullFilePath, constants.F_OK);
    } catch (error) {
      this.logger.error({ msg: `Cannot find file: ${fullFilePath}`, err: error });
      throw new NotFoundError(`Cannot find file: ${fullFilePath}. got error: ${JSON.stringify(error)}`);
    }

    try {
      const { driver, format } = this.getDriver(filePath);
      dataset = await driver.openAsync(fullFilePath, 'r');
      const band = await dataset.bands.getAsync(1); // DEMs are mostly single banded
      await this.validateMetadata({ dataset, band });
      const metadata = await this.getMetadata({ band, dataset, format });
      return metadata;
    } finally {
      dataset?.close();
    }
  }

  private getDriver(filePath: string): { driver: Driver; format: RasterFormats } {
    const fileExtension = extname(filePath).slice(1);
    const supportedFormat = Object.entries(this.supportedFormatsMap).find(([, supportedDriver]) => {
      const driver = this.gdal.drivers.get(supportedDriver);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const driverMetadata = driver.getMetadata() as { DMD_EXTENSION?: string; DMD_EXTENSIONS?: string };
      const { DMD_EXTENSION: extension = '', DMD_EXTENSIONS: extensions = '' } = driverMetadata;
      return [extension, ...extensions.split(' ')].filter((extension) => extension.length > 0).includes(fileExtension);
    });

    if (supportedFormat === undefined) throw new Error(`Unsupported file format of file: ${filePath}`);
    const [format, driverName] = supportedFormat;
    if (!hasKey(format, RASTER_DATA_TYPES)) {
      throw new Error(`Format '${format}' is not part of service's API`);
    }
    const driver = this.gdal.drivers.get(driverName);
    this.logger.debug(`Found driver '${driverName}' supporting file`);
    return { driver, format };
  }

  private async getMetadata({ band, dataset, format }: { band: RasterBand; dataset: Dataset; format: RasterFormats }): Promise<InfoResponse> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const metadata = await dataset.getMetadataAsync();
    const areaOrPoint = z
      // eslint-disable-next-line @typescript-eslint/naming-convention
      .object({ AREA_OR_POINT: areaOrPointSchema })
      .parse(metadata, { error: () => 'Could not extract AREA_OR_POINT metadata' }).AREA_OR_POINT;

    const bandDataType = await band.dataTypeAsync;
    const dataType = pixelDataTypesSchema(format).parse(bandDataType, { error: () => 'Unsupported band data type' });

    const bandNoDataValueAsync = await band.noDataValueAsync;
    const noDataValue = noDataValueSchema.parse(bandNoDataValueAsync, { error: () => 'Unsupported band nodata value' });

    const srs = await dataset.srsAsync;
    if (srs === null) throw new Error('Unsupported SRS');
    const srsInfo = getSrsInfo(srs);
    const { srsId, srsName } = z.strictObject({ srsId: srsIdSchema, srsName: srsNameSchema }).parse(srsInfo, { error: () => 'Unsupported SRS' });

    const geoTransform = await dataset.geoTransformAsync;
    const pixelInfo = getPixelInfo({ geoTransform });

    const { resolutionDegree, resolutionMeter } = getResolutions({
      ...dataset.bands.getEnvelope(),
      ...pixelInfo,
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
  }

  private async validateMetadata({ band, dataset }: { band: RasterBand; dataset: Dataset }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const metadataImageStructure = await dataset.getMetadataAsync('IMAGE_STRUCTURE');
    void z
      // eslint-disable-next-line @typescript-eslint/naming-convention
      .object({ LAYOUT: layoutSchema, COMPRESSION: compressionSchema })
      .parse(metadataImageStructure, { error: () => 'Could not extract LAYOUT metadata' }).LAYOUT;

    const bandBlockSize = await band.blockSizeAsync;
    blockSizeSchema.parse(bandBlockSize, { error: () => 'Unsupported block size' });

    const bandOverviewsCount = await band.overviews.countAsync();
    overviewsCount.parse(bandOverviewsCount, { error: () => 'Could not find overviews' });
  }
}
