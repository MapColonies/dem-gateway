import { CoordinateTransformation, SpatialReference, type Dataset, type Envelope, type xyz } from 'gdal-async';
import * as gdalAsync from 'gdal-async';
import { z } from 'zod';
import type { InfoResponse } from '@src/info/models/infoManager';
import { EPSG_DATA_RECORDS } from './epsg';
import { resolutionDegreeSchema, resolutionMeterSchema } from './schemas';

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

export const getResolutions = (
  options: {
    sourceSrs: SpatialReference | number;
    targetGeographicSrs: SpatialReference | number;
    targetProjectedSrs: SpatialReference | number;
  } & Pick<Envelope, 'minX' | 'minY' | 'maxX' | 'maxY'> &
    PixelInfo
): Pick<InfoResponse, 'resolutionDegree' | 'resolutionMeter'> => {
  const { targetGeographicSrs, targetProjectedSrs, maxX, maxY, minX, minY, pixelHeight, pixelWidth, sourceSrs } = options;
  const resolvedSourceSrs = typeof sourceSrs === 'number' ? SpatialReference.fromEPSG(sourceSrs) : sourceSrs;
  const resolvedTargetGeographicSrs = typeof targetGeographicSrs === 'number' ? SpatialReference.fromEPSG(targetGeographicSrs) : targetGeographicSrs;
  const resolvedTargetProjectedSrs = typeof targetProjectedSrs === 'number' ? SpatialReference.fromEPSG(targetProjectedSrs) : targetProjectedSrs;

  // TODO: how to handle pixelHeight, pixelWidth? mean / max / min ???
  const [dx, dy] = [maxX - minX, maxY - minY];
  const [sourceMinX, sourceMinY, sourceMaxX, sourceMaxY] = [
    /* eslint-disable @typescript-eslint/no-magic-numbers */
    minX + (dx - pixelWidth) / 2,
    minY + (dy - pixelHeight) / 2,
    minX + (dx + pixelWidth) / 2,
    minY + (dy + pixelHeight) / 2,
    /* eslint-enable @typescript-eslint/no-magic-numbers */
  ];

  // approximation of the reprojected resolution
  const getReprojectedResolution = (targetSrs: SpatialReference): number => {
    const { x: targetMinX, y: targetMinY } = transformPoint({
      sourceSrs: resolvedSourceSrs,
      targetSrs,
      point: { x: sourceMinX, y: sourceMinY },
    });
    const { x: targetMaxX, y: targetMaxY } = transformPoint({
      sourceSrs: resolvedSourceSrs,
      targetSrs,
      point: { x: sourceMaxX, y: sourceMaxY },
    });
    const [dxTarget, dyTarget] = [targetMaxX - targetMinX, targetMaxY - targetMinY];

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const reprojectedResolution = (((dxTarget ** 2 + dyTarget ** 2) / (pixelWidth ** 2 + pixelHeight ** 2)) * pixelHeight ** 2) ** 0.5;
    return reprojectedResolution;
  };

  const resolutions = (
    [
      [resolvedSourceSrs.isGeographic(), { resolutionMeter: getReprojectedResolution(resolvedTargetProjectedSrs), resolutionDegree: pixelHeight }],
      [resolvedSourceSrs.isProjected(), { resolutionMeter: pixelHeight, resolutionDegree: getReprojectedResolution(resolvedTargetGeographicSrs) }],
    ] satisfies [boolean, { resolutionMeter: number; resolutionDegree: number }][]
  ).find((value) => value[0])?.[1];

  if (resolutions == undefined) {
    throw new Error('Unsupported SRS type');
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
    throw new Error('Unsupported SRS type');
  }

  return srsName;
};

export const getSrsGeographicBounds = (options: { srsId: number }): [number, number, number, number] => {
  const { srsId } = options;
  const epsgRecord = EPSG_DATA_RECORDS[srsId];
  if (!epsgRecord) throw new Error('Unsupported SRS');

  const [sourceMaxY, sourceMinX, sourceMinY, sourceMaxX] = epsgRecord.bbox;
  return [sourceMinX, sourceMinY, sourceMaxX, sourceMaxY];
};

export const getSrsInfo = (srs: SpatialReference): Pick<InfoResponse, 'srsId' | 'srsName'> => {
  const srsAuthorityCode = srs.getAuthorityCode();
  const srsId = parseInt(srsAuthorityCode);
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
    throw new Error(`Unsupported SRS type of '${srs.getAuthorityName()}:${srs.getAuthorityCode()}'`);
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
