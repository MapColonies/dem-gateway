import * as gdalAsync from 'gdal-async';
import { CoordinateTransformation, SpatialReference, type Dataset, type Envelope, type xyz } from 'gdal-async';
import { Geodesic } from 'geographiclib-geodesic';
import { z } from 'zod';
import type { InfoResponse } from '@src/info/models/infoManager';
import { EPSG_DATA_RECORDS } from './epsg';
import { UnsupportedSrsError } from './errors';
import { resolutionDegreeSchema, resolutionMeterSchema } from './schemas';

const EPSG_CODE_WGS84 = 4326;

interface PixelInfo {
  pixelWidth: number;
  pixelHeight: number;
}

const geoTransformSchema = z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]);

export type GdalAsync = typeof gdalAsync;
export const GDAL_ASYNC = Symbol('gdal');

export const getPixelInfo = (options: Pick<Dataset, 'geoTransform'>): PixelInfo => {
  const { geoTransform } = options;
  const validGeoTransform = geoTransformSchema.parse(geoTransform, { error: () => 'Unsupported geo transform' });
  return { pixelHeight: Math.abs(validGeoTransform[5]), pixelWidth: Math.abs(validGeoTransform[1]) };
};

/**
 * Get resolutions in a bound region
 * @param options - Object with the following properties:
 * @param options.sourceSrs - EPSG code or {@link SpatialReference} instance
 * @param options.minX - Minimum X of region, in `sourceSrs` units
 * @param options.minY - Minimum Y of region, in `sourceSrs` units
 * @param options.maxX - Maximum X of region, in `sourceSrs` units
 * @param options.maxY - Maximum Y of region, in `sourceSrs` units
 * @param options.pixelWidth - Pixel width, in `sourceSrs` units
 * @param options.pixelHeight - Pixel height, in `sourceSrs` units
 * @returns Object of resolutions in meters and degrees on WGS84 ellipsoid
 */
export const getResolutions = (
  options: {
    sourceSrs: SpatialReference | number;
  } & Pick<Envelope, 'minX' | 'minY' | 'maxX' | 'maxY'> &
    PixelInfo
): Pick<InfoResponse, 'resolutionDegree' | 'resolutionMeter'> => {
  const { maxX, maxY, minX, minY, pixelHeight, pixelWidth, sourceSrs } = options;
  const resolvedSourceSrs = typeof sourceSrs === 'number' ? SpatialReference.fromEPSG(sourceSrs) : sourceSrs;

  const [dx, dy] = [maxX - minX, maxY - minY];
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  const [centerX, centerY] = [minX + dx / 2, minY + dy / 2];

  /* eslint-disable @typescript-eslint/no-magic-numbers */
  const { x: targetMinX } = transformPoint({
    sourceSrs: resolvedSourceSrs,
    targetSrs: SpatialReference.fromEPSG(EPSG_CODE_WGS84),
    point: { x: centerX - pixelWidth / 2, y: centerY },
  });
  const { x: targetMaxX } = transformPoint({
    sourceSrs: resolvedSourceSrs,
    targetSrs: SpatialReference.fromEPSG(EPSG_CODE_WGS84),
    point: { x: centerX + pixelWidth / 2, y: centerY },
  });
  const { y: targetMinY } = transformPoint({
    sourceSrs: resolvedSourceSrs,
    targetSrs: SpatialReference.fromEPSG(EPSG_CODE_WGS84),
    point: { x: centerX, y: centerY - pixelHeight / 2 },
  });
  const { y: targetMaxY } = transformPoint({
    sourceSrs: resolvedSourceSrs,
    targetSrs: SpatialReference.fromEPSG(EPSG_CODE_WGS84),
    point: { x: centerX, y: centerY + pixelHeight / 2 },
  });
  /* eslint-enable @typescript-eslint/no-magic-numbers */

  // approximation of the reprojected resolution
  const getReprojectedDegreeResolution = (): number => {
    const [reprojectedResolutionX, reprojectedResolutionY] = [targetMaxX - targetMinX, targetMaxY - targetMinY];

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return (reprojectedResolutionX + reprojectedResolutionY) / 2;
  };

  const getReprojectedMeterResolution = (): number => {
    const geodesicDistanceX = Geodesic.WGS84.Inverse(centerY, targetMinX, centerY, targetMaxX).s12;
    if (geodesicDistanceX === undefined)
      throw new Error(
        `Could not calculate geodesic distance between points (${[centerY, targetMinX].toString()})-(${[centerY, targetMaxX].toString()})]`
      );

    const geodesicDistanceY = Geodesic.WGS84.Inverse(targetMinY, centerX, targetMaxY, centerX).s12;
    if (geodesicDistanceY === undefined)
      throw new Error(
        `Could not calculate geodesic distance between points (${[targetMinY, centerX].toString()})-(${[targetMaxY, centerY].toString()})]`
      );

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    return (geodesicDistanceX + geodesicDistanceY) / 2;
  };

  const resolutions = (
    [
      /* eslint-disable @typescript-eslint/no-magic-numbers */
      [resolvedSourceSrs.isGeographic(), { resolutionMeter: getReprojectedMeterResolution(), resolutionDegree: (pixelWidth + pixelHeight) / 2 }],
      [resolvedSourceSrs.isProjected(), { resolutionMeter: (pixelWidth + pixelHeight) / 2, resolutionDegree: getReprojectedDegreeResolution() }],
      /* eslint-enable @typescript-eslint/no-magic-numbers */
    ] satisfies [boolean, { resolutionMeter: number; resolutionDegree: number }][]
  ).find((value) => value[0])?.[1];

  if (resolutions == undefined) {
    throw new UnsupportedSrsError('Unsupported SRS type');
  }

  const response = z.strictObject({ resolutionMeter: resolutionMeterSchema, resolutionDegree: resolutionDegreeSchema }).parse(resolutions);

  return response;
};

export const getSrsName = (srsId: number): string => {
  const srs = SpatialReference.fromEPSG(srsId);
  const srsName = (
    [
      [srs.isGeographic(), srs.getAttrValue('GEOGCS')],
      [srs.isProjected(), srs.getAttrValue('PROJCS')],
    ] satisfies [boolean, string][]
  ).find((value) => value[0])?.[1];

  if (srsName == undefined) {
    throw new UnsupportedSrsError('Unsupported SRS type');
  }

  return srsName;
};

export const getSrsGeographicBounds = (options: { srsId: number }): [number, number, number, number] => {
  const { srsId } = options;
  const epsgRecord = EPSG_DATA_RECORDS[srsId];
  if (!epsgRecord) throw new UnsupportedSrsError('Unsupported SRS');

  const [sourceMaxY, sourceMinX, sourceMinY, sourceMaxX] = epsgRecord.bbox;
  return [sourceMinX, sourceMinY, sourceMaxX, sourceMaxY];
};

export const getSrsInfo = (srs: SpatialReference): Pick<InfoResponse, 'srsId' | 'srsName'> => {
  const srsAuthorityCode = srs.getAuthorityCode();
  const srsId = parseInt(srsAuthorityCode);
  if (Number.isNaN(srsId)) throw new UnsupportedSrsError('Unsupported SRS');
  const srsName = getSrsName(srsId);

  return {
    srsId,
    srsName,
  };
};

/**
 * Swap coordinate order to have a { x: lon, y: lat } order, if needed
 * @param options - Object with the following properties:
 * @param options.point - Point to swap order if needed
 * @param options.srs - SRS
 * @returns Point with swapped coordinates
 */
export const swapCoordinateOrder = (options: { srs: SpatialReference; point: xyz }): xyz => {
  const { point, srs } = options;

  let swappedPoint: xyz;

  if (srs.isGeographic()) {
    swappedPoint = srs.EPSGTreatsAsLatLong() ? { x: point.y, y: point.x } : point;
  } else if (srs.isProjected()) {
    swappedPoint = srs.EPSGTreatsAsNorthingEasting() ? { x: point.y, y: point.x } : point;
  } else {
    throw new UnsupportedSrsError(`Unsupported SRS type of '${srs.getAuthorityName()}:${srs.getAuthorityCode()}'`);
  }

  return swappedPoint;
};

/**
 * Reproject point
 * @param options - Object with the following properties:
 * @param options.point - Point to be transfomed (long/lat or east/north order)
 * @param options.sourceSrs - Source SRS
 * @param options.targetSrs - Target SRS
 * @returns Reprojected point
 */
export const transformPoint = (options: { point: xyz; sourceSrs: SpatialReference; targetSrs: SpatialReference }): xyz => {
  const { point, sourceSrs, targetSrs } = options;

  const sourcePoint = swapCoordinateOrder({ point, srs: sourceSrs });
  const coordinateTransformation = new CoordinateTransformation(sourceSrs, targetSrs);
  const transformedPoint = coordinateTransformation.transformPoint(sourcePoint);
  const targetPoint = swapCoordinateOrder({ point: transformedPoint, srs: targetSrs });

  return targetPoint;
};
