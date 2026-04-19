import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import type { OpenAPIV3_1 } from 'openapi-types';
import { dereference } from '@readme/openapi-parser';

// eslint-disable-next-line no-useless-escape
const urlTemplateAllowedValues = `([A-Za-z0-9\-\._~]|%[0-9A-Fa-f]{2}|[!$&'()*+,;=]|[:@\/])*`;

export type RemoveNever<T> = {
  [K in keyof T as T[K] extends undefined ? never : K]: T[K];
};
export type OasMethodsOfPath<P, T extends keyof P> = keyof Omit<RemoveNever<P[T]>, 'parameters'>;
export type OasOperationOfMethod<P, T extends keyof P, M extends OasMethodsOfPath<P, T>> = P[T][M];
export type OasStatusCodesOfMethod<P, T extends keyof P, M extends OasMethodsOfPath<P, T>> =
  OasOperationOfMethod<P, T, M> extends Record<PropertyKey, unknown> ? keyof OasOperationOfMethod<P, T, M>['responses'] : never;

// @readme/openapi-parser
export type OpenApiDocument = Awaited<ReturnType<typeof dereference>>;
export type Paths = NonNullable<OpenApiDocument['paths']>;
export type Path = NonNullable<Paths[number | string]>;
export type PathKeys = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch';
export type Method = NonNullable<Path[PathKeys]>;
export type Responses = Method['responses'];
export type Response = NonNullable<Responses[number | string]>;
export type Content = NonNullable<Extract<Response, { content?: unknown }>['content']>;
export type MediaType = Content[number | string];
export type Schema = MediaType['schema'];

/**
 * Basic route matcher: converts "/users/{id}" in spec to regex
 */
export function matchRoute(openapiPath: string, actualPath: string): boolean {
  const regexPath = openapiPath.replace(/{.+}/g, urlTemplateAllowedValues);

  return new RegExp(`^${regexPath}$`).test(actualPath);
}

export const parseOpenApi = async (options?: { openApiDoc: string }): Promise<OpenAPIV3_1.Document> => {
  const { openApiDoc } = options ?? { openApiDoc: 'openapi3.yaml' };
  const specPath = resolve(process.cwd(), openApiDoc);
  const spec = readFileSync(specPath, 'utf8');
  const openApiDocument = await dereference<OpenAPIV3_1.Document>(spec);
  return openApiDocument;
};

export function findSchemaInSpec(spec: OpenAPIV3_1.Document, path: string, method: string, status: number): OpenAPIV3_1.SchemaObject {
  if (spec.paths?.[path] === undefined) {
    throw new Error(`Path '${path}' not found in spec.`);
  }

  const pathItem = spec.paths[path];
  const operation = pathItem[method.toLowerCase() as OpenAPIV3_1.HttpMethods];

  if (!operation) {
    throw new Error(`Method '${method}' not defined for '${path}'.`);
  }

  const response = operation.responses[String(status)] as OpenAPIV3_1.ResponseObject;
  const content = response.content?.['application/json'];

  if (!content?.schema) {
    throw new Error(`No JSON schema found for '${method} ${path} ${status}'.`);
  }

  return content.schema;
}
