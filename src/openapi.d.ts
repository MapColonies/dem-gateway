/* eslint-disable */
// This file was auto-generated. Do not edit manually.
// To update, run the error generation script again.

import type { TypedRequestHandlers as ImportedTypedRequestHandlers } from '@map-colonies/openapi-helpers/typedRequestHandler';
export type paths = {
  '/dem': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Create a DEM resource */
    post: operations['create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/dem/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Delete an existing DEM resource */
    delete: operations['delete'];
    options?: never;
    head?: never;
    /** Edit an existing DEM resource */
    patch: operations['edit'];
    trace?: never;
  };
  '/dem/{id}/status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** Edit status for existing DEM resource */
    patch: operations['editStatus'];
    trace?: never;
  };
  '/info': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Extracts GDAL info from the provided DEM file */
    post: operations['info'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: {
    /**
     * @description Indicates whether each raster pixel represents an area or point
     * @enum {string}
     */
    AreaOrPoint: 'Area' | 'Point';
    /** @description Permitted roles, value must be between 0 and 100 */
    Classification: string;
    CreateRequestBody: {
      metadata: components['schemas']['DemMetadata'];
      inputFiles: components['schemas']['InputFiles'];
    };
    /**
     * @description GeoTiff supported data types
     * @enum {string}
     */
    GeoTiffDataType: 'Int8' | 'Int16' | 'Int32' | 'Int64' | 'Float16' | 'Float32' | 'Float64';
    /**
     * @description Input file paths
     * @example /path/to/example.tif
     */
    DemFilePath: string;
    DemMetadata: {
      classification: components['schemas']['Classification'];
      productId: components['schemas']['ProductId'];
      productName: components['schemas']['ProductName'];
      productType: components['schemas']['ProductType'];
      region: components['schemas']['Region'];
      description?: components['schemas']['Description'];
      geoidModel?: components['schemas']['GeoidModel'];
      keywords?: components['schemas']['Keywords'];
      producerName?: components['schemas']['ProducerName'];
      productSubType?: components['schemas']['ProductSubType'];
    };
    DemResponse: {
      /** Format: uuid */
      jobId: string;
    };
    /** @description Layer's description */
    Description: string;
    EditRequestBody: {
      classification?: components['schemas']['Classification'];
      description?: components['schemas']['Description'];
      geoidModel?: components['schemas']['GeoidModel'];
      keywords?: components['schemas']['Keywords'];
      producerName?: components['schemas']['ProducerName'];
      productName?: components['schemas']['ProductName'];
      region?: components['schemas']['Region'];
    };
    EditStatusRequestBody: {
      status: components['schemas']['Status'];
    };
    ErrorMessage: {
      message: string;
      stacktrace?: string;
    };
    /** @description Earth's geoid model */
    GeoidModel: string;
    /** @description Common properties of regular grids */
    InfoCommonRegularGridProperties: {
      areaOrPoint: components['schemas']['AreaOrPoint'];
      resolutionDegree: components['schemas']['ResolutionDegree'];
      resolutionMeter: components['schemas']['ResolutionMeter'];
      srsId: components['schemas']['SrsId'];
      srsName: components['schemas']['SrsName'];
    };
    /** @description Info request body */
    InfoRequestBody: {
      demFilePath: components['schemas']['DemFilePath'];
    };
    /** @description Info response body */
    InfoResponse: components['schemas']['InfoGeoTiff'];
    /** @description Info properties of GeoTiff */
    InfoGeoTiff: components['schemas']['InfoCommonRegularGridProperties'] & {
      dataType: components['schemas']['GeoTiffDataType'];
      noDataValue: components['schemas']['NoDataValue'];
    };
    InputFiles: {
      demFilePath: components['schemas']['DemFilePath'];
      metadataShapefilePath: components['schemas']['MetadataShapefilePath'];
      productShapefilePath: components['schemas']['ProductShapefilePath'];
    };
    Keywords: string;
    /**
     * Format: uuid
     * @description Layer's identifier
     * @example c52d8189-7e07-456a-8c6b-53859523c3e9
     */
    LayerId: string;
    /**
     * @description Metadata shape file path
     * @example /path/to/ShapeMetadata.shp
     */
    MetadataShapefilePath: string;
    NoDataValue: number | 'NaN';
    /**
     * @description The status of the DEM
     * @default UNPUBLISHED
     * @enum {string}
     */
    Status: 'PUBLISHED' | 'UNPUBLISHED';
    /**
     * @description Layer's producer name default to 'IDFMU'
     * @default IDFMU
     */
    ProducerName: string;
    /**
     * @description Layer's external identifier, must start with a letter and contain only letters, numbers and underscores
     * @example SRTM
     */
    ProductId: string;
    /** @description Layer's external name */
    ProductName: string;
    /** @description Layer's sub type */
    ProductSubType: string;
    /**
     * @description Layer's type, list of DEM product types
     * @enum {string}
     */
    ProductType: 'DTM' | 'DSM' | 'DTMBest' | 'DSMBest';
    /**
     * @description Product shape file path
     * @example /path/to/Product.shp
     */
    ProductShapefilePath: string;
    /** @description List of layer's regions */
    Region: string[];
    /** @description DEM resolution in degrees */
    ResolutionDegree: number;
    /** @description DEM resolution in meters */
    ResolutionMeter: number;
    /** @description Projection code as registered by EPSG */
    SrsId: number;
    /** @description Projection name as registered by EPSG */
    SrsName: string;
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
  create: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateRequestBody'];
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DemResponse'];
        };
      };
      /** @description Bad Request */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Conflict */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Unprocessable Content */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Internal Server Error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
    };
  };
  delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description The id of the DEM to delete */
        id: components['schemas']['LayerId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DemResponse'];
        };
      };
      /** @description Bad Request */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Not Found */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Conflict */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Unprocessable Content */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Internal Server Error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
    };
  };
  edit: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description The id of the DEM to edit */
        id: components['schemas']['LayerId'];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['EditRequestBody'];
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DemResponse'];
        };
      };
      /** @description Bad Request */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Not Found */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Conflict */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Unprocessable Content */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Internal Server Error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
    };
  };
  editStatus: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description The id of the DEM whose status to edit */
        id: components['schemas']['LayerId'];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['EditStatusRequestBody'];
      };
    };
    responses: {
      /** @description No Content */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Bad Request */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Not Found */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Conflict */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Unprocessable Content */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Internal Server Error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
    };
  };
  info: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** @description An object containing object of DEM input file */
    requestBody: {
      content: {
        'application/json': components['schemas']['InfoRequestBody'];
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['InfoResponse'];
        };
      };
      /** @description Bad Request */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Not Found */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Unprocessable Content */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
      /** @description Internal Server Error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorMessage'];
        };
      };
    };
  };
}
export type TypedRequestHandlers = ImportedTypedRequestHandlers<paths, operations>;
