# Shared errors (Python SDK reference)

## Contents

- [DaytonaError](#daytonaerror)
- [DaytonaBadRequestError](#daytonabadrequesterror)
- [DaytonaAuthenticationError](#daytonaauthenticationerror)
- [DaytonaForbiddenError](#daytonaforbiddenerror)
- [DaytonaNotFoundError](#daytonanotfounderror)
- [DaytonaTimeoutError](#daytonatimeouterror)
- [DaytonaConflictError](#daytonaconflicterror)
- [DaytonaGoneError](#daytonagoneerror)
- [DaytonaUnprocessableEntityError](#daytonaunprocessableentityerror)
- [DaytonaRateLimitError](#daytonaratelimiterror)
- [DaytonaInternalServerError](#daytonainternalservererror)
- [DaytonaServiceUnavailableError](#daytonaserviceunavailableerror)
- [DaytonaConnectionError](#daytonaconnectionerror)

## DaytonaError

```python
class DaytonaError(Exception)
```

Base of every error the SDK raises, in either namespace.

The fields below are set by both namespaces' error classes (v0's and
v2's); they are annotated here, without values, so code catching the root
class type-checks. A bare marker instance does not carry them.

**Attributes**:

- `message` _str_
- `status_code` _Optional\[int\]_
- `code` _Optional\[str\]_
- `source` _Optional\[str\]_

## DaytonaBadRequestError

```python
class DaytonaBadRequestError(DaytonaError)
```

The request was rejected as invalid (HTTP 400 and client-side validation).

## DaytonaAuthenticationError

```python
class DaytonaAuthenticationError(DaytonaError)
```

Missing or invalid credentials (HTTP 401).

## DaytonaForbiddenError

```python
class DaytonaForbiddenError(DaytonaError)
```

The credentials do not allow the operation (HTTP 403).

## DaytonaNotFoundError

```python
class DaytonaNotFoundError(DaytonaError)
```

The resource does not exist (HTTP 404).

## DaytonaTimeoutError

```python
class DaytonaTimeoutError(DaytonaError)
```

A request or wait timed out, on the server (HTTP 408) or in the client.

## DaytonaConflictError

```python
class DaytonaConflictError(DaytonaError)
```

The resource's state does not allow the operation (HTTP 409).

## DaytonaGoneError

```python
class DaytonaGoneError(DaytonaError)
```

The resource is gone for good (HTTP 410).

## DaytonaUnprocessableEntityError

```python
class DaytonaUnprocessableEntityError(DaytonaError)
```

The request was well-formed but could not be processed (HTTP 422).

## DaytonaRateLimitError

```python
class DaytonaRateLimitError(DaytonaError)
```

Too many requests, or a quota was exceeded (HTTP 429).

## DaytonaInternalServerError

```python
class DaytonaInternalServerError(DaytonaError)
```

The server failed (HTTP 500).

## DaytonaServiceUnavailableError

```python
class DaytonaServiceUnavailableError(DaytonaError)
```

The service is temporarily unavailable (HTTP 503).

## DaytonaConnectionError

```python
class DaytonaConnectionError(DaytonaError)
```

The API could not be reached.
