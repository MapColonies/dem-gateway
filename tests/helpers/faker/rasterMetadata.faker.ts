/* eslint-disable @typescript-eslint/no-magic-numbers */
import { faker } from '@faker-js/faker';
import { drivers, SpatialReference } from 'gdal-async';
import { merge } from 'lodash';
import { z } from 'zod';
import { fake } from 'zod-schema-faker/v4';
import { getConfig } from '@src/common/config';
import { RASTER_DATA_TYPES } from '@src/common/constants';
import { getResolutions, getSrsGeographicBounds, getSrsName, transformPoint } from '@src/common/gdal';
import { type PixelDataType } from '@src/common/interfaces';
import {
  areaOrPointSchema,
  blockSizeSchema,
  compressionSchema,
  layoutSchema,
  overviewsCountSchema,
  resolutionDegreeSchema,
  srsIdSchema,
} from '@src/common/schemas';
import type { CreateGDALRasterOptions } from '@tests/helpers/generators/gdal';
import type { DemType, InfoGeoTiff } from '@tests/helpers/interfaces';

const MAX_FLOAT32 = (2 - Math.pow(2, -23)) * Math.pow(2, 127);
const MAX_INT64 = 2n ** 63n;
const MAX_PIXELS_DIM = 10; // keep as low number of pixels for quicker performance in tests

const config = getConfig();
const supportedFormatsMap: Record<string, string> = config.get('application.supportedFormatsMap');

const regularGridMetadata = z.strictObject({
  areaOrPoint: areaOrPointSchema,
  srsId: srsIdSchema,
});

const geotiffMetadataSchema = z.strictObject({
  ...regularGridMetadata.shape,
});

const geotiffGDALMetadataSchema = z.strictObject({
  ...geotiffMetadataSchema.shape,
  blockSize: blockSizeSchema.shape.x,
  compression: compressionSchema,
  layout: layoutSchema,
});

const createPixelDataTypeValue = (dataType: PixelDataType): number => {
  switch (dataType) {
    // case 'Byte': {
    //   const value = faker.number.int({ min: 0, max: 255 });
    //   return Number(new Uint8Array([value])[0]);
    // }
    // case 'CInt16': {
    //   const [value1, value2] = [faker.number.int({ min: -32768, max: 32767 }), faker.number.int({ min: -32768, max: 32767 })];
    //   return Number(new Int16Array([value1, value2])[0]);
    // }
    // case 'CInt32': {
    //   const [value1, value2] = [faker.number.int({ min: -2147483648, max: 2147483647 }), faker.number.int({ min: -2147483648, max: 2147483647 })];
    //   return Number(new Int32Array([value1, value2])[0]);
    // }
    // case 'CFloat16': {
    //   const [value1, value2] = [faker.number.float({ min: -65504, max: 65504 }), faker.number.float({ min: -65504, max: 65504 })];
    //   return Number(new Float16Array([value1, value2])[0]);
    // }
    // case 'CFloat32': {
    //   const [value1, value2] = [
    //     faker.number.float({ min: -MAX_FLOAT32, max: MAX_FLOAT32 }),
    //     faker.number.float({ min: -MAX_FLOAT32, max: MAX_FLOAT32 }),
    //   ];
    //   return Number(new Float32Array([value1, value2])[0]);
    // }
    // case 'CFloat64': {
    //   const [value1, value2] = [
    //     faker.number.float({ min: -Number.MAX_VALUE, max: Number.MAX_VALUE }),
    //     faker.number.float({ min: -Number.MAX_VALUE, max: Number.MAX_VALUE }),
    //   ];
    //   return Number(new Float64Array([value1, value2])[0]);
    // }
    case 'Int8': {
      const value = faker.number.int({ min: -128, max: 127 });
      return Number(new Int8Array([value])[0]);
    }
    case 'Int16': {
      const value = faker.number.int({ min: -32768, max: 32767 });
      return Number(new Int16Array([value])[0]);
    }
    case 'Int32': {
      const value = faker.number.int({ min: -2147483648, max: 2147483647 });
      return Number(new Int32Array([value])[0]);
    }
    case 'Int64': {
      const value = faker.number.bigInt({ min: -MAX_INT64, max: MAX_INT64 - 1n });
      return Number(new BigInt64Array([BigInt(value)])[0]);
    }
    // case 'UInt16': {
    //   const value = faker.number.int({ min: 0, max: 65535 });
    //   return Number(new Uint16Array([value])[0]);
    // }
    // case 'UInt32': {
    //   const value = faker.number.int({ min: 0, max: 4294967295 });
    //   return Number(new Uint32Array([value])[0]);
    // }
    // case 'UInt64': {
    //   const value = faker.number.bigInt({ min: 0n });
    //   return Number(new BigUint64Array([BigInt(value)])[0]);
    // }
    case 'Float16': {
      const value = faker.number.float({ min: -65504, max: 65504 });
      return Number(new Float16Array([value])[0]);
    }
    case 'Float32': {
      const value = faker.number.float({ min: -MAX_FLOAT32, max: MAX_FLOAT32 });
      return Number(new Float32Array([value])[0]);
    }
    case 'Float64': {
      // faker overflows to infinity in inner calculations thats we get half the range and then decide on the sign
      const value = faker.helpers.arrayElement([1, -1]) * faker.number.float({ min: 0, max: Number.MAX_VALUE });
      return Number(new Float64Array([value])[0]);
    }
    default:
      throw new Error('Unsupported pixel data type');
  }
};

export const createGDALRasterMetadata = (options: Partial<InfoGeoTiff> & DemType): CreateGDALRasterOptions => {
  const { demType, ...overrides } = options;
  const driverName = supportedFormatsMap[demType];
  const supportedDataTypes = RASTER_DATA_TYPES[demType];
  if (driverName === undefined) throw new Error(`Unsupported dem type: ${demType}`);

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const driverMetadata = drivers.get(driverName).getMetadata() as unknown as { DMD_CREATIONDATATYPES: string };

  const driverPixelDataTypes = driverMetadata.DMD_CREATIONDATATYPES.split(' ').filter((driverPixelDataType): driverPixelDataType is PixelDataType =>
    (supportedDataTypes as string[]).includes(driverPixelDataType)
  );
  if (driverPixelDataTypes.length === 0) throw new Error(`Unsupported data types for dem type: ${demType}`);
  const dataType = faker.helpers.arrayElement(driverPixelDataTypes);
  const fakePixelDataTypeValue = createPixelDataTypeValue(dataType);
  const noDataValue = faker.helpers.arrayElement([fakePixelDataTypeValue, Number.NaN]);

  // TODO: adjust to support not only geotiff/COG
  const rasterMetadata = fake(geotiffGDALMetadataSchema) satisfies Omit<
    CreateGDALRasterOptions,
    | 'dataType'
    | 'driverName'
    | 'maxX'
    | 'maxY'
    | 'minX'
    | 'minY'
    | 'noDataValue'
    | 'overviewsCount'
    | 'pixelHeight'
    | 'pixelWidth'
    | 'resolutionDegree'
    | 'resolutionMeter'
    | 'srsName'
    | 'xSize'
    | 'ySize'
  >;

  const sourceSrs = SpatialReference.fromEPSG(4326); // source bbox is in WGS84 (EPSG:4326)
  const targetSrs = SpatialReference.fromEPSG(rasterMetadata.srsId);

  const resolutionDegree = fake(resolutionDegreeSchema);
  const [geoSrsMinX, geoSrsMinY, geoSrsMaxX, geoSrsMaxY] = getSrsGeographicBounds({ srsId: rasterMetadata.srsId });
  const [pixelsX, pixelsY] = [
    Math.max(1, Math.min(MAX_PIXELS_DIM, Math.floor((geoSrsMaxX - geoSrsMinX) / resolutionDegree))),
    Math.max(1, Math.min(MAX_PIXELS_DIM, Math.floor((geoSrsMaxY - geoSrsMinY) / resolutionDegree))),
  ];
  const [geoWidth, geoHeight] = [pixelsX * resolutionDegree, pixelsY * resolutionDegree];
  const [geoMinX, geoMinY] = [
    faker.number.float({ min: geoSrsMinX, max: geoSrsMaxX - geoWidth }),
    faker.number.float({ min: geoSrsMinY, max: geoSrsMaxY - geoHeight }),
  ];
  const [geoMaxX, geoMaxY] = [geoMinX + geoWidth, geoMinY + geoHeight];

  const [{ x: minX }, { x: maxX }, { y: minY }, { y: maxY }] = [
    transformPoint({
      point: { x: geoMinX, y: (geoMinY + geoMaxY) / 2 },
      sourceSrs,
      targetSrs,
    }),
    transformPoint({
      point: { x: geoMaxX, y: (geoMinY + geoMaxY) / 2 },
      sourceSrs,
      targetSrs,
    }),
    transformPoint({
      point: { x: (geoMinX + geoMaxX) / 2, y: geoMinY },
      sourceSrs,
      targetSrs,
    }),
    transformPoint({
      point: { x: (geoMinX + geoMaxX) / 2, y: geoMaxY },
      sourceSrs,
      targetSrs,
    }),
  ];

  const pixelHeight = Math.abs(maxY - minY) / pixelsY;
  const pixelWidth = Math.abs(maxX - minX) / pixelsX;

  const overviewsCount = fake(
    overviewsCountSchema({
      blockSize: { x: rasterMetadata.blockSize, y: rasterMetadata.blockSize },
      size: { x: pixelsX, y: pixelsY },
    })
  );

  const resolutions = getResolutions({
    maxX,
    maxY,
    minX,
    minY,
    pixelHeight,
    pixelWidth,
    sourceSrs: rasterMetadata.srsId,
  });

  return merge(
    rasterMetadata,
    {
      ...resolutions,
      driverName,
      dataType,
      maxX,
      maxY,
      minX,
      minY,
      noDataValue: Number.isNaN(noDataValue) ? 'NaN' : noDataValue,
      overviewsCount,
      pixelHeight,
      pixelWidth,
      srsName: getSrsName(rasterMetadata.srsId),
      xSize: pixelsX,
      ySize: pixelsY,
    },
    overrides
  );
};
