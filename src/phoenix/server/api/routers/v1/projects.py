from typing import Optional

from fastapi import APIRouter, HTTPException, Path, Query
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
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType

router = APIRouter(tags=["projects"])


class ProjectData(V1RoutesBaseModel):
    name: str
    description: Optional[str] = None


class Project(ProjectData):
    id: str


class GetProjectsResponseBody(PaginatedResponseBody[Project]):
    pass


class GetProjectResponseBody(ResponseBody[Project]):
    pass


class CreateProjectRequestBody(V1RoutesBaseModel):
    project: ProjectData


class CreateProjectResponseBody(ResponseBody[Project]):
    pass


class UpdateProjectRequestBody(V1RoutesBaseModel):
    project: ProjectData


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
        description="Cursor for pagination (base64-encoded project ID)",
    ),
    limit: int = Query(
        default=100, description="The max number of projects to return at a time.", gt=0
    ),
) -> GetProjectsResponseBody:
    """
    Retrieve a paginated list of all projects in the system.

    Args:
        request (Request): The FastAPI request object.
        cursor (Optional[str]): Pagination cursor (base64-encoded project ID).
        limit (int): Maximum number of projects to return per request.

    Returns:
        GetProjectsResponseBody: Response containing a list of projects and pagination information.

    Raises:
        HTTPException: If the cursor format is invalid.
    """  # noqa: E501
    async with request.app.state.db() as session:
        stmt = select(models.Project).order_by(models.Project.id.desc())

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
        result = await session.execute(stmt)
        orm_projects = result.scalars().all()

        if not orm_projects:
            return GetProjectsResponseBody(next_cursor=None, data=[])

        next_cursor = None
        if len(orm_projects) == limit + 1:
            last_project = orm_projects[-1]
            next_cursor = str(GlobalID(ProjectNodeType.__name__, str(last_project.id)))
            orm_projects = orm_projects[:-1]

        projects = [_project_from_orm_project(orm_project) for orm_project in orm_projects]
    return GetProjectsResponseBody(next_cursor=next_cursor, data=projects)


@router.get(
    "/projects/{project_id}",
    operation_id="getProject",
    summary="Get project by ID",  # noqa: E501
    description="Retrieve a specific project using its unique identifier.",  # noqa: E501
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
    project_id: str = Path(description="The ID of the project."),
) -> GetProjectResponseBody:
    """
    Retrieve a specific project by its ID.

    Args:
        request (Request): The FastAPI request object.
        project_id (str): The ID of the project to retrieve.

    Returns:
        GetProjectResponseBody: Response containing the requested project.

    Raises:
        HTTPException: If the project ID is invalid or the project is not found.
    """  # noqa: E501
    async with request.app.state.db() as session:
        try:
            id_ = from_global_id_with_expected_type(
                GlobalID.from_id(project_id),
                ProjectNodeType.__name__,
            )
            project = await session.get(models.Project, id_)
        except ValueError:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid project ID format: {project_id}",
            )

        if project is None:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found",
            )

    data = _project_from_orm_project(project)
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
    project = request_body.project
    async with request.app.state.db() as session:
        project_orm = models.Project(
            name=project.name,
            description=project.description,
        )
        session.add(project_orm)
        await session.flush()
    data = _project_from_orm_project(project_orm)
    return CreateProjectResponseBody(data=data)


@router.put(
    "/projects/{project_id}",
    operation_id="updateProject",
    summary="Update a project",  # noqa: E501
    description="Update an existing project with new configuration. Project names cannot be changed.",  # noqa: E501
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
    project_id: str = Path(description="The ID of the project to update."),
) -> UpdateProjectResponseBody:
    """
    Update an existing project.

    Args:
        request (Request): The FastAPI request object.
        request_body (UpdateProjectRequestBody): The request body containing updated project data.
        project_id (str): The ID of the project to update.

    Returns:
        UpdateProjectResponseBody: Response containing the updated project.

    Raises:
        HTTPException: If the project ID is invalid, the project is not found, or the name is changed.
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
        try:
            id_ = from_global_id_with_expected_type(
                GlobalID.from_id(project_id),
                ProjectNodeType.__name__,
            )
            project_orm = await session.get(models.Project, id_)
        except ValueError:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid project ID format: {project_id}",
            )

        if project_orm is None:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found",
            )

        # Prevent changing the project name
        if project_orm.name != request_body.project.name:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Project names cannot be changed",
            )

        # Only update the description
        project_orm.description = request_body.project.description

    data = _project_from_orm_project(project_orm)
    return UpdateProjectResponseBody(data=data)


@router.delete(
    "/projects/{project_id}",
    operation_id="deleteProject",
    summary="Delete a project",  # noqa: E501
    description="Delete an existing project and all its associated data.",  # noqa: E501
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
    project_id: str = Path(description="The ID of the project to delete."),
) -> None:
    """
    Delete an existing project.

    Args:
        request (Request): The FastAPI request object.
        project_id (str): The ID of the project to delete.

    Returns:
        None: Returns a 204 No Content response on success.

    Raises:
        HTTPException: If the project ID is invalid, the project is not found, or it's the default project.
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
        try:
            id_ = from_global_id_with_expected_type(
                GlobalID.from_id(project_id),
                ProjectNodeType.__name__,
            )
            project = await session.get(models.Project, id_)
        except ValueError:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid project ID format: {project_id}",
            )

        if project is None:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found",
            )

        # The default project must not be deleted - it's forbidden
        if project.name == DEFAULT_PROJECT_NAME:
            raise HTTPException(
                status_code=HTTP_403_FORBIDDEN,
                detail="The default project cannot be deleted",
            )

        await session.delete(project)
    return None


def _project_from_orm_project(orm_project: models.Project) -> Project:
    return Project(
        id=str(GlobalID(ProjectNodeType.__name__, str(orm_project.id))),
        name=orm_project.name,
        description=orm_project.description,
    )
