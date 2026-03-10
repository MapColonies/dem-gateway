import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { httpLogger } from '@map-colonies/express-access-log-middleware';
import type { Logger } from '@map-colonies/js-logger';
import { OpenapiViewerRouter } from '@map-colonies/openapi-express-viewer';
import { collectMetricsExpressMiddleware } from '@map-colonies/prometheus';
import bodyParser from 'body-parser';
import compression from 'compression';
import express, { Router } from 'express';
import { middleware as OpenApiMiddleware } from 'express-openapi-validator';
import { Registry } from 'prom-client';
import { inject, injectable } from 'tsyringe';
import type { ConfigType } from '@common/config';
import { SERVICES } from '@common/constants';
import { DEM_ROUTER_SYMBOL } from './dem/routes/demRouter';
import { INFO_ROUTER_SYMBOL } from './info/routes/infoRouter';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METRICS) private readonly metricsRegistry: Registry,
    @inject(DEM_ROUTER_SYMBOL) private readonly demRouter: Router,
    @inject(INFO_ROUTER_SYMBOL) private readonly infoRouter: Router
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.buildRoutes();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private buildDocsRoutes(): void {
    const openapiRouter = new OpenapiViewerRouter({
      ...this.config.get('openapiConfig'),
      filePathOrSpec: this.config.get('openapiConfig.filePath'),
    });
    openapiRouter.setup();
    this.serverInstance.use(this.config.get('openapiConfig.basePath'), openapiRouter.getRouter());
  }

  private buildRoutes(): void {
    this.serverInstance.use('/dem', this.demRouter);
    this.serverInstance.use('/info', this.infoRouter);
    this.buildDocsRoutes();
  }

  private registerPreRoutesMiddleware(): void {
    this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry }));
    this.serverInstance.use(httpLogger({ logger: this.logger, ignorePaths: ['/metrics'] }));

    if (this.config.get('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get('server.response.compression.options') as unknown as compression.CompressionFilter));
    }

    this.serverInstance.use(bodyParser.json(this.config.get('server.request.payload')));

    const ignorePathRegex = new RegExp(`^${this.config.get('openapiConfig.basePath')}/.*`, 'i');
    const apiSpecPath = this.config.get('openapiConfig.filePath');
    this.serverInstance.use(OpenApiMiddleware({ apiSpec: apiSpecPath, validateRequests: true, ignorePaths: ignorePathRegex }));
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
  }
}
