from typing import Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from starlette.status import (
    HTTP_204_NO_CONTENT,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.db.enums import UserRole
from phoenix.db.helpers import exclude_experiment_projects
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    _get_project_by_identifier,
    add_errors_to_responses,
)
from phoenix.server.api.types.Project import Project as ProjectNodeType

router = APIRouter(tags=["projects"])


class ProjectData(V1RoutesBaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None


class Project(ProjectData):
    id: str


class GetProjectsResponseBody(PaginatedResponseBody[Project]):
    pass


class GetProjectResponseBody(ResponseBody[Project]):
    pass


class CreateProjectRequestBody(ProjectData):
    pass


class CreateProjectResponseBody(ResponseBody[Project]):
    pass


class UpdateProjectRequestBody(V1RoutesBaseModel):
    description: Optional[str] = None


class UpdateProjectResponseBody(ResponseBody[Project]):
    pass


@router.get(
    "/projects",
    operation_id="getProjects",
    summary="List all projects",  # noqa: E501
    description="Retrieve a paginated list of all projects in the system.",  # noqa: E501
    response_description="A list of projects with pagination information",  # noqa: E501
    responses=add_errors_to_responses(
        [
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def get_projects(
    request: Request,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (project ID)",
    ),
    limit: int = Query(
        default=100, description="The max number of projects to return at a time.", gt=0
    ),
    include_experiment_projects: bool = Query(
        default=False,
        description="Include experiment projects in the response. Experiment projects are created from running experiments.",  # noqa: E501
    ),
) -> GetProjectsResponseBody:
    """
    Retrieve a paginated list of all projects in the system.

    Args:
        request (Request): The FastAPI request object.
        cursor (Optional[str]): Pagination cursor (project ID).
        limit (int): Maximum number of projects to return per request.
        include_experiment_projects (bool): Flag to include experiment projects in the response.
            Experiment projects are created from running experiments.

    Returns:
        GetProjectsResponseBody: Response containing a list of projects and pagination information.

    Raises:
        HTTPException: If the cursor format is invalid.
    """  # noqa: E501
    stmt = select(models.Project).order_by(models.Project.id.desc())
    if not include_experiment_projects:
        stmt = exclude_experiment_projects(stmt)
    async with request.app.state.db() as session:
        if cursor:
            try:
                cursor_id = GlobalID.from_id(cursor).node_id
                stmt = stmt.filter(models.Project.id <= int(cursor_id))
            except ValueError:
                raise HTTPException(
                    detail=f"Invalid cursor format: {cursor}",
                    status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                )

        stmt = stmt.limit(limit + 1)
        projects = (await session.scalars(stmt)).all()

        if not projects:
            return GetProjectsResponseBody(next_cursor=None, data=[])

        next_cursor = None
        if len(projects) == limit + 1:
            last_project = projects[-1]
            next_cursor = str(GlobalID(ProjectNodeType.__name__, str(last_project.id)))
            projects = projects[:-1]

        project_responses = [_to_project_response(project) for project in projects]
    return GetProjectsResponseBody(next_cursor=next_cursor, data=project_responses)


@router.get(
    "/projects/{project_identifier}",
    operation_id="getProject",
    summary="Get project by ID or name",  # noqa: E501
    description="Retrieve a specific project using its unique identifier: either project ID or project name. Note: When using a project name as the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) characters.",  # noqa: E501
    response_description="The requested project",  # noqa: E501
    responses=add_errors_to_responses(
        [
            HTTP_404_NOT_FOUND,
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def get_project(
    request: Request,
    project_identifier: str = Path(
        description="The project identifier: either project ID or project name. If using a project name, it cannot contain slash (/), question mark (?), or pound sign (#) characters.",  # noqa: E501
    ),
) -> GetProjectResponseBody:
    """
    Retrieve a specific project by its ID or name.

    Args:
        request (Request): The FastAPI request object.
        project_identifier (str): The project identifier: either project ID or project name.
            If using a project name, it cannot contain slash (/), question mark (?), or pound sign (#) characters.

    Returns:
        GetProjectResponseBody: Response containing the requested project.

    Raises:
        HTTPException: If the project identifier format is invalid or the project is not found.
    """  # noqa: E501
    async with request.app.state.db() as session:
        project = await _get_project_by_identifier(session, project_identifier)
    data = _to_project_response(project)
    return GetProjectResponseBody(data=data)


@router.post(
    "/projects",
    operation_id="createProject",
    summary="Create a new project",  # noqa: E501
    description="Create a new project with the specified configuration.",  # noqa: E501
    response_description="The newly created project",  # noqa: E501
    responses=add_errors_to_responses(
        [
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def create_project(
    request: Request,
    request_body: CreateProjectRequestBody,
) -> CreateProjectResponseBody:
    """
    Create a new project.

    Args:
        request (Request): The FastAPI request object.
        request_body (CreateProjectRequestBody): The request body containing project data.

    Returns:
        CreateProjectResponseBody: Response containing the created project.

    Raises:
        HTTPException: If any validation error occurs.
    """
    async with request.app.state.db() as session:
        project = models.Project(
            name=request_body.name,
            description=request_body.description,
        )
        session.add(project)
        await session.flush()
    data = _to_project_response(project)
    return CreateProjectResponseBody(data=data)


@router.put(
    "/projects/{project_identifier}",
    operation_id="updateProject",
    summary="Update a project by ID or name",  # noqa: E501
    description="Update an existing project with new configuration. Project names cannot be changed. The project identifier is either project ID or project name. Note: When using a project name as the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) characters.",  # noqa: E501
    response_description="The updated project",  # noqa: E501
    responses=add_errors_to_responses(
        [
            HTTP_403_FORBIDDEN,
            HTTP_404_NOT_FOUND,
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def update_project(
    request: Request,
    request_body: UpdateProjectRequestBody,
    project_identifier: str = Path(
        description="The project identifier: either project ID or project name. If using a project name, it cannot contain slash (/), question mark (?), or pound sign (#) characters.",  # noqa: E501
    ),
) -> UpdateProjectResponseBody:
    """
    Update an existing project.

    Args:
        request (Request): The FastAPI request object.
        request_body (UpdateProjectRequestBody): The request body containing the new description.
        project_identifier (str): The project identifier: either project ID or project name.
            If using a project name, it cannot contain slash (/), question mark (?), or pound sign (#) characters.

    Returns:
        UpdateProjectResponseBody: Response containing the updated project.

    Raises:
        HTTPException: If the project identifier format is invalid or the project is not found.
    """  # noqa: E501
    if request.app.state.authentication_enabled:
        async with request.app.state.db() as session:
            # Check if the user is an admin
            stmt = (
                select(models.UserRole.name)
                .join(models.User)
                .where(models.User.id == int(request.user.identity))
            )
            role_name = await session.scalar(stmt)
        if role_name != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="Only admins can update projects",
            )
    async with request.app.state.db() as session:
        project = await _get_project_by_identifier(session, project_identifier)

        # Update the description if provided
        if request_body.description is not None:
            project.description = request_body.description

    data = _to_project_response(project)
    return UpdateProjectResponseBody(data=data)


@router.delete(
    "/projects/{project_identifier}",
    operation_id="deleteProject",
    summary="Delete a project by ID or name",  # noqa: E501
    description="Delete an existing project and all its associated data. The project identifier is either project ID or project name. The default project cannot be deleted. Note: When using a project name as the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) characters.",  # noqa: E501
    response_description="No content returned on successful deletion",  # noqa: E501
    status_code=HTTP_204_NO_CONTENT,
    responses=add_errors_to_responses(
        [
            HTTP_403_FORBIDDEN,
            HTTP_404_NOT_FOUND,
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def delete_project(
    request: Request,
    project_identifier: str = Path(
        description="The project identifier: either project ID or project name. If using a project name, it cannot contain slash (/), question mark (?), or pound sign (#) characters.",  # noqa: E501
    ),
) -> None:
    """
    Delete an existing project.

    Args:
        request (Request): The FastAPI request object.
        project_identifier (str): The project identifier: either project ID or project name.
            If using a project name, it cannot contain slash (/), question mark (?), or pound sign (#) characters.

    Returns:
        None: Returns a 204 No Content response on success.

    Raises:
        HTTPException: If the project identifier format is invalid, the project is not found, or it's the default project.
    """  # noqa: E501
    if request.app.state.authentication_enabled:
        async with request.app.state.db() as session:
            # Check if the user is an admin
            stmt = (
                select(models.UserRole.name)
                .join(models.User)
                .where(models.User.id == int(request.user.identity))
            )
            role_name = await session.scalar(stmt)
        if role_name != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="Only admins can delete projects",
            )
    async with request.app.state.db() as session:
        project = await _get_project_by_identifier(session, project_identifier)

        # The default project must not be deleted - it's forbidden
        if project.name == DEFAULT_PROJECT_NAME:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="The default project cannot be deleted",
            )

        await session.delete(project)
    return None


def _to_project_response(project: models.Project) -> Project:
    return Project(
        id=str(GlobalID(ProjectNodeType.__name__, str(project.id))),
        name=project.name,
        description=project.description,
    )
