# dem-gateway

Gateway for DEM resources manipulation

## Development

When in development you should use the command `npm run start:dev`. The main benefits are that it enables offline mode for the config package, and source map support for NodeJS errors.

### Adding a New Handler

<!-- TODO add sections for /info & /dem-->
Before all, check if existing handlers can fulfill your need. For example, [`gdal handler`](src/info//fileHandlers/gdal.ts) can handle most of raster file formats.

Add a new file handler under `src/info/fileHandlers`. The file should contain a class implementing the `FileHandler` interface.
Verify that OpenAPI spec supports the file format associated with the new handler. OpenAPI validates input file formats through a RegEx pattern.

Add a new or record into the [default.json](config/default.json) under `application.supportedFormatsMap` in the form of:

```json
{
  ...
  "application": {
    ...
    "supportedFormatsMap": {
      ...
      "formatName": "drivername"
    },
    ...
  }
}

```
This configuration is used to map common format names into a given file handler internal name. For example, the gdal handler maps formats into gdal's internal driver name.

Finally, since DI is utilized a new record for the new handler should be added in [containerConfig.ts](src/containerConfig.ts):

```javascript
const dependencies: InjectionObject<unknown>[] = [
    ...
    { token: 'FileHandler', provider: { useClass: NewHandler } }
];
```

## API

Checkout the OpenAPI spec [here](/openapi3.yaml)

## Installation

Install deps with npm

```bash
npm install
```

## Run Locally

Clone the project

```bash
git clone https://link-to-project
```

Go to the project directory

```bash
cd my-project
```

Install dependencies

```bash
npm install
```

Start the server

```bash
npm run start
```

## Running Tests

To run tests, run the following command

```bash
npm run test
```

To only run unit tests:

```bash
npm run test:unit
```

To only run integration tests:

```bash
npm run test:integration
```
