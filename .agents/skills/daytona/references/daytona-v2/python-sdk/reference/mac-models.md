# MacModels (Python SDK reference)

## Contents

- [MacModelsService](#macmodelsservice)
- [AsyncMacModelsService](#asyncmacmodelsservice)
- [MacModel](#macmodel)
- [MacCatalog](#maccatalog)
- [MacCatalogRegion](#maccatalogregion)
- [MacCatalogModel](#maccatalogmodel)
- [MacPrice](#macprice)

## MacModelsService

```python
class MacModelsService()
```

The Mac model registry (`GET /mac-models`).

Lists the models `reservations.create(model=...)` accepts, with each
model's CPU cores, physical memory, physical SSD capacity and sandbox
disk room in MiB, maximum sandbox count, and default sandbox size. `catalog()` adds free Macs
and prices.

#### MacModelsService.\_\_init\_\_

```python
def __init__() -> None
```

#### MacModelsService.catalog

```python
def catalog(*, region: Optional[str] = None) -> MacCatalog
```

Free Macs and prices per Mac model (GET /mac-catalog). available is advisory; price is null when pricing is unavailable.

#### MacModelsService.list

```python
def list() -> Tuple[MacModel, ...]
```

Every registered Mac model, ordered by `id`.

## AsyncMacModelsService

```python
class AsyncMacModelsService()
```

The Mac model registry (`GET /mac-models`).

Lists the models `reservations.create(model=...)` accepts, with each
model's CPU cores, physical memory, physical SSD capacity and sandbox
disk room in MiB, maximum sandbox count, and default sandbox size. `catalog()` adds free Macs
and prices.

#### AsyncMacModelsService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncMacModelsService.list

```python
async def list() -> Tuple[MacModel, ...]
```

Every registered Mac model, ordered by `id`.

#### AsyncMacModelsService.catalog

```python
async def catalog(*, region: Optional[str] = None) -> MacCatalog
```

Free Macs and prices per Mac model (GET /mac-catalog). available is advisory; price is null when pricing is unavailable.

## MacModel

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacModel()
```

A registered Mac model (`GET /mac-models`).

`memory_mib` and `disk_mib` are the Mac's physical memory and SSD;
`sandbox_disk_mib` is the disk room for sandboxes on one Mac;
`max_sandboxes` how many run at once; `default_size` the size a create
gives each size it omits.

**Attributes**:

- `id` _str_
- `name` _str_
- `cores` _int_
- `memory_mib` _int_
- `disk_mib` _int_
- `sandbox_disk_mib` _int_
- `max_sandboxes` _int_
- `default_size` _Optional\[MacResources\] = None_

## MacCatalog

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacCatalog()
```

`GET /mac-catalog`: per region, the default model and each model's free Macs and price.

**Attributes**:

- `regions` _tuple\[MacCatalogRegion, ...\]_

## MacCatalogRegion

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacCatalogRegion()
```

**Attributes**:

- `id` _str_
- `default_model` _str_
- `models` _tuple\[MacCatalogModel, ...\]_

## MacCatalogModel

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacCatalogModel()
```

One Mac model in a region: `available` free Macs (advisory) and its `price` (`None` without pricing).

**Attributes**:

- `model` _MacModel_
- `available` _int_
- `price` _Optional\[MacPrice\] = None_

## MacPrice

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class MacPrice()
```

What one reservation of a Mac model costs: `period_cents` per `period_seconds`.

**Attributes**:

- `cents_per_hour` _float_
- `period_cents` _int_
- `period_seconds` _int_
- `currency` _str_
