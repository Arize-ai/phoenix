# MacModels (TypeScript SDK reference)

## MacModelsService

The Mac model registry (`GET /mac-models`): the models `reservations.create({ model })`
accepts, with each model's CPU cores, physical memory, physical SSD capacity and
sandbox disk room in MiB, maximum sandbox count, and default sandbox size. `catalog()` adds free Macs and prices.

### Constructors

#### Constructor

```ts
new MacModelsService(http: AxiosInstance): MacModelsService;
```

**Parameters**:

- `http` _AxiosInstance_

**Returns**:

- `MacModelsService`

### Methods

#### catalog()

```ts
catalog(options: { region?: string } = {}): Promise<MacCatalog>;
```

Free Macs and prices per Mac model (GET /mac-catalog). available is advisory; price is null when pricing is unavailable.

**Parameters**:

- `options` _\{ region?: string \} = \{\}_

**Returns**:

- `Promise<MacCatalog>`

#### list()

```ts
list(): Promise<MacModel[]>;
```

Every registered Mac model, ordered by `id`.

**Returns**:

- `Promise<MacModel[]>`

***

## MacModel

```ts
type MacModel = api.MacModel
```

A registered Mac model (`GET /mac-models`), with its physical resources,
sandbox disk room, `max_sandboxes`, and `default_size` for omitted create sizes.

***

## MacCatalog

```ts
type MacCatalog = api.MacCatalog
```

`GET /mac-catalog`: per region, the default model and each model's `MacModel`, free Macs (`available`) and `price` (null when pricing is unavailable).
