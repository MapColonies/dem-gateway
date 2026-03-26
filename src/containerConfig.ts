import type { Logger } from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import * as gdalAsync from 'gdal-async';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import { getConfig } from '@common/config';
import { SERVICES, SERVICE_NAME } from '@common/constants';
import { InjectionObject, registerDependencies, type Providers } from '@common/dependencyRegistration';
import { GDAL_ASYNC } from '@common/gdal';
import { getTracing } from '@common/tracing';
import { loggerFactory } from './common/logger';
import { DEM_ROUTER_SYMBOL, demRouterFactory } from './dem/routes/demRouter';
import { GDALHandler } from './info/fileHandlers/gdal';
import { INFO_ROUTER_SYMBOL, infoRouterFactory } from './info/routes/infoRouter';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const configInstance = getConfig();

  const tracer = trace.getTracer(SERVICE_NAME);
  const metricsRegistry = new Registry();
  configInstance.initializeMetrics(metricsRegistry);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
    {
      token: SERVICES.LOGGER,
      provider: {
        useAsync: async (dependencyContainer: DependencyContainer): Promise<Providers<Logger>> => {
          const logger = await loggerFactory(dependencyContainer);
          return { useValue: logger };
        },
      },
    },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METRICS, provider: { useValue: metricsRegistry } },
    { token: DEM_ROUTER_SYMBOL, provider: { useFactory: demRouterFactory } },
    { token: GDAL_ASYNC, provider: { useValue: gdalAsync } },
    { token: 'FileHandler', provider: { useClass: GDALHandler } },
    { token: INFO_ROUTER_SYMBOL, provider: { useFactory: infoRouterFactory } },
    {
      token: 'onSignal',
      provider: {
        useValue: async (): Promise<void> => {
          await Promise.all([getTracing().stop()]);
        },
      },
    },
  ];

  return Promise.resolve(registerDependencies(dependencies, options?.override, options?.useChild));
};
