"""Idempotently create and grant the baseline AI permissions to User/Manager roles."""

from __future__ import annotations

import asyncio

from app import crud
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Permission, PermissionGroup, Role
from app.schemas.users.permission_group_schema import IPermissionGroupCreate
from app.schemas.users.permission_schema import IPermissionCreate

PERMISSION_GROUP_NAME = "AI"

# The regular User role can use chat and read available profiles/capabilities.
# Manager receives those permissions plus profile/conversation administration.
ROLE_PERMISSIONS = {
    "User": {
        "ai.capabilities.read",
        "ai.conversations.read",
        "ai.conversations.create",
        "ai.runs.create",
        "ai.profiles.read",
        "ai.tasks.read",
        "ai.tasks.create",
    },
    "Manager": {
        "ai.capabilities.read",
        "ai.conversations.read",
        "ai.conversations.create",
        "ai.conversations.manage",
        "ai.runs.create",
        "ai.profiles.read",
        "ai.profiles.create",
        "ai.profiles.manage",
        "ai.tasks.read",
        "ai.tasks.create",
        "ai.tasks.manage",
    },
}

PERMISSIONS = {
    "ai.capabilities.read": "Read AI capability information.",
    "ai.conversations.read": "Read AI conversations and messages.",
    "ai.conversations.create": "Create AI conversations.",
    "ai.conversations.manage": "Update and delete AI conversations.",
    "ai.runs.create": "Start AI runs.",
    "ai.profiles.read": "Read AI agent profiles.",
    "ai.profiles.create": "Create AI agent profiles.",
    "ai.profiles.manage": "Archive AI agent profiles.",
    "ai.tasks.read": "Read AI tasks.",
    "ai.tasks.create": "Create AI tasks.",
    "ai.tasks.manage": "Manage AI tasks.",
}


async def main() -> None:
    async with SessionLocal() as db:
        actor = await crud.user.get_by_email(
            email=settings.FIRST_SUPERUSER_EMAIL,
            db_session=db,
        )
        if actor is None:
            raise RuntimeError(
                f"Initial superuser was not found: {settings.FIRST_SUPERUSER_EMAIL}"
            )

        group = await crud.permission_group.get_by_name(
            name=PERMISSION_GROUP_NAME,
            db_session=db,
        )
        if group is None:
            group = await crud.permission_group.create(
                obj_in=IPermissionGroupCreate(
                    name=PERMISSION_GROUP_NAME,
                    description="Global RBAC permissions for AI features.",
                    created_by_id=actor.id,
                ),
                db_session=db,
            )

        permissions: dict[str, Permission] = {}
        for name, description in PERMISSIONS.items():
            permission = await crud.permission.get_by_name(name=name, db_session=db)
            if permission is None:
                permission = await crud.permission.create(
                    obj_in=IPermissionCreate(
                        name=name,
                        description=description,
                        group_id=group.id,
                    ),
                    db_session=db,
                )
            permissions[name] = permission

        for role_name, permission_names in ROLE_PERMISSIONS.items():
            role: Role | None = await crud.role.get_role_by_name(
                name=role_name,
                db_session=db,
            )
            if role is None:
                print(f"[SKIP] Role not found: {role_name}")
                continue

            await crud.role.assign_permissions(
                role_id=role.id,
                permission_ids=[permissions[name].id for name in sorted(permission_names)],
                current_user=actor,
                db_session=db,
            )
            print(f"[OK] {role_name}: {', '.join(sorted(permission_names))}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
