# MacModels (Python SDK reference)

## Contents

- [MacModelService](#macmodelservice)
- [AsyncMacModelService](#asyncmacmodelservice)
- [MacModel](#macmodel)
- [MacCatalog](#maccatalog)

## MacModelService

```python
class MacModelService()
```

The Mac model registry (`GET /mac-models`).

#### MacModelService.\_\_init\_\_

```python
def __init__(impl: AsyncMacModelService, bridge: SyncBridge) -> None
```

#### MacModelService.catalog

```python
def catalog(*, region: Optional[str] = None) -> MacCatalog
```

Free Macs and prices per Mac model (GET /mac-catalog). available is advisory; price is null when pricing is unavailable.

#### MacModelService.list

```python
def list() -> List[MacModel]
```

Every registered Mac model, ordered by `id`.

## AsyncMacModelService

```python
class AsyncMacModelService()
```

The Mac model registry (`GET /mac-models`).

Lists the models `reservations.create(model=...)` accepts, with each
model's CPU cores, physical memory, physical SSD capacity and sandbox
disk room in MiB, maximum sandbox count, and default sandbox size. `catalog()` adds free Macs
and prices.

#### AsyncMacModelService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncMacModelService.list

```python
async def list() -> List[MacModel]
```

Every registered Mac model, ordered by `id`.

#### AsyncMacModelService.catalog

```python
async def catalog(*, region: Optional[str] = None) -> MacCatalog
```

Free Macs and prices per Mac model (GET /mac-catalog). available is advisory; price is null when pricing is unavailable.

## MacModel

```python
class MacModel(BaseModel)
```

A Mac model.

**Attributes**:

- `cores` _StrictInt = Field(description='CPU cores in the Mac. A Mac core is one CPU (Apple Silicon has no SMT).')_
- `default_size` _Optional\[MacResources\]_
- `disk_mib` _StrictInt = Field(description='Physical SSD capacity in MiB, not free space or a per-sandbox disk allowance.')_
- `id` _StrictStr = Field(description='Mac model slug accepted by POST /reservations.')_
- `max_sandboxes` _StrictInt = Field(description='Most sandboxes a Mac of this model runs at once: 2 when its cores, memory, and sandbox disk room each fit two minimum-sized sandboxes (4 cores, 4096 MiB, 81920 MiB of disk), 1 when they fit one, and 0 when they fit none. The sizes of the running sandboxes must also fit the Mac.')_
- `memory_mib` _StrictInt = Field(description='Physical memory in MiB.')_
- `name` _StrictStr = Field(description='Display name of the Mac model.')_
- `sandbox_disk_mib` _StrictInt = Field(description="Disk room for sandboxes on one Mac of this model, in MiB. The disks of all sandboxes on the Mac, stopped sandboxes included, add up to at most this. Zero until the model's disk room is measured.")_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### MacModel.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### MacModel.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### MacModel.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of MacModel from a JSON string

#### MacModel.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### MacModel.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of MacModel from a dict

## MacCatalog

```python
class MacCatalog(BaseModel)
```

Free Macs and prices per Mac model, per region.

**Attributes**:

- `regions` _List\[MacCatalogRegion\] = Field(description='Every region the answer covers, in catalog order.')_
- `additional_properties` _Dict\[str, Any\] = \{\}_

##### model\_config

```python
model_config = ConfigDict(populate_by_name=True, validate_assignment=True, protected_namespaces=())
```

#### MacCatalog.to\_str

```python
def to_str() -> str
```

Returns the string representation of the model using alias

#### MacCatalog.to\_json

```python
def to_json() -> str
```

Returns the JSON representation of the model using alias

#### MacCatalog.from\_json

```python
@classmethod
def from_json(json_str: str) -> Optional[Self]
```

Create an instance of MacCatalog from a JSON string

#### MacCatalog.to\_dict

```python
def to_dict() -> Dict[str, Any]
```

Return the dictionary representation of the model using alias.

This has the following differences from calling pydantic's
`self.model_dump(by_alias=True)`:

* `None` is only added to the output dict for nullable fields that
  were set at model initialization. Other fields with value `None`
  are ignored.
* Fields in `self.additional_properties` are added to the output dict.

#### MacCatalog.from\_dict

```python
@classmethod
def from_dict(obj: Optional[Dict[str, Any]]) -> Optional[Self]
```

Create an instance of MacCatalog from a dict
