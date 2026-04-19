import { resolve } from 'node:path';
import type { RequestSender } from '@map-colonies/openapi-helpers/requestSender';
import { dereference } from '@readme/openapi-parser';
import addFormats from 'ajv-formats';
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020';
import type { OpenAPIV3_1 } from 'openapi-types';
import { beforeAll, expect } from 'vitest';
import type { operations, paths } from '@src/openapi';
import { matchRoute } from '../setupOpenApiSpec';

type ExpectationResult = ReturnType<RawMatcherFn>;
type MatcherState = ReturnType<(typeof expect)['getState']>;
type RawMatcherFn = Parameters<(typeof expect)['extend']>[0][number];
type SupertestResponse = Awaited<ReturnType<RequestSender<paths, operations>['sendRequest']>>;
type TestContext = { matcherName: string } & Pick<MatcherState, 'isNot'> & MatcherState['utils'];

const strictAjv = new Ajv2020({
  allErrors: true,
  discriminator: true,
  strict: true,
  strictRequired: false,
  useDefaults: true,
});
addFormats(strictAjv);

const coerciveAjv = new Ajv2020({
  allErrors: true,
  coerceTypes: true,
  useDefaults: true,
});
addFormats(coerciveAjv);

const getHintedErrorOnProperty = (
  { received, property, type }: { received: unknown; property: string; type: string },
  {
    isNot,
    matcherHint,
    matcherName,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    RECEIVED_COLOR,
    printReceived,
    printWithType,
  }: TestContext
): string =>
  matcherErrorMessage(
    matcherHint(matcherName, 'response', 'expected', { isNot }),
    `${RECEIVED_COLOR('received')} must have '${property}' property with '${type}' type`,
    printWithType('Received', received, printReceived)
  );

const isSupertestResponse = (received: unknown, context: TestContext): received is SupertestResponse => {
  const { isNot, matcherHint, matcherName, RECEIVED_COLOR, printReceived, printWithType } = context;
  if (typeof received !== 'object' || received === null) {
    throw new TypeError(
      matcherErrorMessage(
        matcherHint(matcherName, 'object', 'expected', { isNot }),
        `${RECEIVED_COLOR('Received:')} ${printReceived(received)}`,
        printWithType('Received', received, printReceived)
      )
    );
  }

  if (!('status' in received && typeof received.status === 'number')) {
    throw new TypeError(getHintedErrorOnProperty({ received, property: 'status', type: 'number' }, context));
  }

  if (!('type' in received && typeof received.type === 'string')) {
    throw new TypeError(getHintedErrorOnProperty({ received, property: 'type', type: 'string' }, context));
  }

  if (!('request' in received && typeof received.request === 'object' && received.request !== null)) {
    throw new TypeError(getHintedErrorOnProperty({ received, property: 'request', type: 'object' }, context));
  }

  const request = received.request;

  if (!('method' in request && typeof request.method === 'string')) {
    throw new TypeError(getHintedErrorOnProperty({ received, property: 'request.method', type: 'string' }, context));
  }

  if (!('url' in request && typeof request.method === 'string')) {
    throw new TypeError(getHintedErrorOnProperty({ received, property: 'request.url', type: 'string' }, context));
  }

  return true;
};

const parseOpenApi = async (options?: { openApiDoc: string }): Promise<OpenAPIV3_1.Document> => {
  const { openApiDoc } = options ?? { openApiDoc: 'openapi3.yaml' };
  const specPath = resolve(process.cwd(), openApiDoc);
  const openApiDocument = await dereference<OpenAPIV3_1.Document>(specPath);
  return openApiDocument;
};

const findSchemaInSpec = (
  openApiDocument: OpenAPIV3_1.Document,
  path: string,
  method: string,
  status: number,
  media?: string
): Pick<OpenAPIV3_1.ResponseObject, 'headers'> & Pick<OpenAPIV3_1.MediaTypeObject, 'schema'> => {
  if (openApiDocument.paths?.[path] === undefined) {
    throw new Error(`Path '${path}' not found in spec`);
  }

  const pathItem = openApiDocument.paths[path];
  const operation = pathItem[method.toLowerCase() as OpenAPIV3_1.HttpMethods];

  if (!operation) {
    throw new Error(`Method '${method}' not defined for '${path}'`);
  }

  const response = operation.responses[String(status)];

  if (!response) throw new Error(`Could not find a matching response for '${method} ${path} ${status}'`);
  if ('$ref' in response) throw new Error('Responses should have been dereferenced');

  const schema = media !== undefined ? response.content?.[media]?.schema : undefined;
  const headers = response.headers;

  return { schema, headers };
};

const extractRequestInfo = (received: SupertestResponse): { mediaType: string; method: string; path: string } => {
  const {
    type: mediaType,
    request: { method, url },
  } = received;
  const path = new URL(url).pathname;

  return { mediaType, method, path };
};

const matcherErrorMessage = (...args: string[]): string => args.join('\n');

const toSatisfyApiSpecFactory = (openApiDocument: OpenAPIV3_1.Document): RawMatcherFn => {
  function toSatisfyApiSpec(this: MatcherState, received: unknown): ExpectationResult {
    const matcherName = 'toSatisfyApiSpec';
    const { isNot, utils } = this;
    const { matcherHint, printReceived, RECEIVED_COLOR } = utils;

    try {
      if (!isSupertestResponse(received, { ...utils, isNot, matcherName })) throw new Error();
      const { mediaType: requestMediaType, method: requestMethod, path: requestPath } = extractRequestInfo(received);
      const status = received.status;

      // Find the matching OpenAPI path (handles path parameters like {id})
      let matchedOpenApiPath: string | undefined;
      if (openApiDocument.paths) {
        matchedOpenApiPath = Object.keys(openApiDocument.paths).find((openApiPath) => matchRoute(openApiPath, requestPath));
      }

      if (matchedOpenApiPath === undefined) {
        throw new Error(`No matching path found in OpenAPI spec for request path: '${requestPath}'`);
      }

      // Find and validate the schema
      const { schema, headers } = findSchemaInSpec(openApiDocument, matchedOpenApiPath, requestMethod, status, requestMediaType);
      let passSchema = true;
      let passHeaders = true;
      let schemaErrors: ErrorObject[] | null | undefined;
      let headersErrors: ErrorObject[] | null | undefined;

      if (schema && 'body' in received) {
        const validateSchema = strictAjv.compile(schema);
        passSchema = validateSchema(received.body);
        schemaErrors = validateSchema.errors;
      }

      if (headers && 'headers' in received) {
        const headersSchema = {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(headers as { [header: string]: OpenAPIV3_1.HeaderObject }).map(([key, value]) => {
              if (!(value.schema || value.content?.[requestMediaType]?.schema)) {
                throw new Error(`OpenAPI spec headers should contain either 'content' or 'schema'`);
              }
              return [key.toLowerCase(), value.schema ?? value.content?.[requestMediaType]?.schema];
            })
          ),
          required: Object.entries(headers as { [header: string]: OpenAPIV3_1.HeaderObject })
            .filter(([, value]) => value.required === true)
            .map(([key]) => key.toLowerCase()),
          additionalProperties: true, // Accept extra headers that are typically undeclared
        };
        const validateHeaders = coerciveAjv.compile(headersSchema);
        passHeaders = validateHeaders(received.headers);
        headersErrors = validateHeaders.errors;
      }

      const pass = passSchema && passHeaders;
      const errors = [
        !passSchema && strictAjv.errorsText(schemaErrors, { dataVar: 'response.body' }),
        !passHeaders && coerciveAjv.errorsText(headersErrors, { dataVar: 'response.headers' }),
      ]
        .filter(Boolean)
        .join(';');

      return {
        pass,
        message: (): string =>
          pass
            ? `Expected response not to match OpenAPI spec for ${requestMethod.toUpperCase()} ${matchedOpenApiPath} ${status}`
            : `OAS 3.1 Validation Error for ${requestMethod.toUpperCase()} ${matchedOpenApiPath} ${status}: ${errors}`,
      };
    } catch (error: unknown) {
      return {
        pass: false,
        message: (): string => `${matcherHint(matcherName, 'received', '', { isNot })}
        Error: ${error instanceof Error ? error.message : JSON.stringify(error)}
        ${RECEIVED_COLOR('Received:')} ${printReceived(received)}`,
      };
    }
  }
  return toSatisfyApiSpec;
};

beforeAll(async () => {
  try {
    const openApiDocument = await parseOpenApi();
    const toSatisfyApiSpec = toSatisfyApiSpecFactory(openApiDocument);
    expect.extend({
      toSatisfyApiSpec,
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
});
