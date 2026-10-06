

## WarmPoolService

Service for managing Daytona Warm Pools.

This service provides methods to list, create, update, and delete Warm Pools.

### Constructors

#### Constructor

```ts
new WarmPoolService(warmPoolsApi: WarmPoolsApi): WarmPoolService;
```

**Parameters**:

- `warmPoolsApi` _WarmPoolsApi_


**Returns**:

- `WarmPoolService`

### Methods

#### create()

```ts
create(params: CreateWarmPool): Promise<WarmPool>;
```

Creates a new Warm Pool.

**Parameters**:

- `params` _CreateWarmPool_ - Parameters for the new Warm Pool


**Returns**:

- `Promise<WarmPool>` - The newly created Warm Pool

**Throws**:

If a Warm Pool for the same snapshot and region already exists

**Example:**

```ts
const daytona = new Daytona();
const pool = await daytona.warmPool.create({ snapshot: 'my-snapshot', pool: 5 });
console.log(`Created warm pool ${pool.id} in ${pool.target}`);
```

#### delete()

```ts
delete(warmPoolId: string): Promise<void>;
```

Deletes a Warm Pool.

**Parameters**:

- `warmPoolId` _string_ - ID of the Warm Pool to delete


**Returns**:

- `Promise<void>`

**Throws**:

If the Warm Pool does not exist

**Example:**

```ts
const daytona = new Daytona();
await daytona.warmPool.delete("warm-pool-id");
```

#### list()

```ts
list(): Promise<WarmPool[]>;
```

Lists all Warm Pools in the organization.

**Returns**:

- `Promise<WarmPool[]>` - List of all Warm Pools

**Example:**

```ts
const daytona = new Daytona();
const pools = await daytona.warmPool.list();
pools.forEach(pool => console.log(`${pool.snapshot}: ${pool.currentSize}/${pool.pool} ready`));
```

#### update()

```ts
update(warmPoolId: string, params: UpdateWarmPool): Promise<WarmPool>;
```

Updates the desired size of a Warm Pool.

**Parameters**:

- `warmPoolId` _string_ - ID of the Warm Pool to update
- `params` _UpdateWarmPool_ - Fields to update (`pool: 0` drains the pool)


**Returns**:

- `Promise<WarmPool>` - The updated Warm Pool

**Throws**:

If the Warm Pool does not exist

**Example:**

```ts
const daytona = new Daytona();
const pool = await daytona.warmPool.update("warm-pool-id", { pool: 10 });
```

***


## WarmPool

```ts
type WarmPool = WarmPoolDto & {
  __brand: "WarmPool";
};
```

Represents a Daytona Warm Pool which keeps ready-to-use Sandboxes for a snapshot.

`currentSize` versus `pool` is the pool's status: `currentSize` is the number of ready
warm sandboxes, `pool` is the desired number. `errorReason` is set when the pool cannot
be filled.

### Type Declaration

#### \_\_brand

```ts
__brand: "WarmPool";
```
