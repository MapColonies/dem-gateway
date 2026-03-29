import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type Logger, jsLogger } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/tracing-utils';
import type { AttributeValue, Attributes } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import { get } from 'lodash';
import type { DependencyContainer } from 'tsyringe';
import type { ConfigType } from './config';
import { SERVICES } from './constants';

const logContext = new AsyncLocalStorage<Attributes>();

export function addOperationIdToLog(req: IncomingMessage, res: ServerResponse, loggableObject: Record<string, unknown>): unknown {
  const operationId = get(req, 'openapi.schema.operationId') as string | undefined;
  if (operationId !== undefined) {
    loggableObject['operationId'] = operationId;
  }

  const store = logContext.getStore();
  const span = api.trace.getActiveSpan();

  if (store) {
    span?.setAttributes(store);
  }

  return loggableObject;
}

export function enrichLogContext(values: Attributes, addToCurrentTrace = false): void {
  const store = logContext.getStore();
  if (store) {
    Object.assign(store, values);
  }

  if (addToCurrentTrace) {
    const span = api.trace.getActiveSpan();
    span?.setAttributes(values);
  }
}

export function getLogContext(): Attributes | undefined {
  return structuredClone(logContext.getStore());
}

export async function loggerFactory(container: DependencyContainer): Promise<Logger> {
  const config = container.resolve<ConfigType>(SERVICES.CONFIG);
  const loggerConfig = config.get('telemetry.logger');

  const logger = await jsLogger({
    ...loggerConfig,
    mixin: (mergeObj, level) => {
      const otelMixin = getOtelMixin();
      const store = logContext.getStore();

      return { ...otelMixin(mergeObj, level), ...store };
    },
  });

  return logger;
}

export function logContextInjectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  logContext.run({}, () => {
    next();
  });
}

export function logEnrichmentParamMiddlewareFactory(
  logEntry: string
): (req: Request, res: Response, next: NextFunction, paramValue: AttributeValue) => void {
  return function (req: Request, res: Response, next: NextFunction, paramValue: AttributeValue): void {
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (paramValue) {
      enrichLogContext({ [logEntry]: paramValue });
    }
    next();
  };
}
