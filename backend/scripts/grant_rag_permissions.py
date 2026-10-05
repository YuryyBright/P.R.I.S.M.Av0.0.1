"""One-time migration for RAG collection RBAC permissions.

Adds the canonical permissions:

    rag.collections.read
    rag.collections.create
    rag.collections.manage

Role mapping:

    User:
        rag.collections.read

    Manager:
        rag.collections.read
        rag.collections.create
        rag.collections.manage

This migration is idempotent.

Collection-level authorization remains handled by:
    CollectionMember
    AccessPolicy

This script only configures global RBAC capabilities.
"""

from __future__ import annotations

import asyncio

from app import crud
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Permission as PermissionModel
from app.models import PermissionGroup as PermissionGroupModel
from app.models import Role as RoleModel
from app.schemas.users.permission_group_schema import IPermissionGroupCreate
from app.schemas.users.permission_schema import IPermissionCreate


# ============================================================================
# Configuration
# ============================================================================

PERMISSION_GROUP_NAME = "RAG Collections"

COLLECTION_PERMISSIONS = {
    "rag.collections.read": "Read RAG collections.",
    "rag.collections.create": "Create RAG collections.",
    "rag.collections.manage": "Manage RAG collections.",
}

ROLE_PERMISSIONS = {
    "User": {
        "rag.collections.read",
    },
    "Manager": {
        "rag.collections.read",
        "rag.collections.create",
        "rag.collections.manage",
    },
}


# ============================================================================
# Permission group
# ============================================================================


async def get_or_create_permission_group(
    *,
    db_session,
    superuser,
) -> PermissionGroupModel:
    """Get existing permission group or create it."""

    permission_group = await crud.permission_group.get_by_name(
        name=PERMISSION_GROUP_NAME,
        db_session=db_session,
    )

    if permission_group:
        print(
            f"[OK] Permission group already exists: "
            f"{permission_group.name}"
        )
        return permission_group

    permission_group = await crud.permission_group.create(
        obj_in=IPermissionGroupCreate(
            name=PERMISSION_GROUP_NAME,
            description="Global RBAC permissions for RAG collections.",
            created_by_id=superuser.id,
        ),
        db_session=db_session,
    )

    print(
        f"[CREATE] Permission group: "
        f"{permission_group.name}"
    )

    return permission_group


# ============================================================================
# Permissions
# ============================================================================


async def get_or_create_permission(
    *,
    db_session,
    permission_group: PermissionGroupModel,
    permission_name: str,
    description: str,
) -> PermissionModel:
    """Get existing permission or create it with its canonical name."""

    permission = await crud.permission.get_by_name(
        name=permission_name,
        db_session=db_session,
    )

    if permission:
        print(
            f"[OK] Permission already exists: "
            f"{permission.name}"
        )
        return permission

    permission = await crud.permission.create(
        obj_in=IPermissionCreate(
            name=permission_name,
            description=description,
            group_id=permission_group.id,
        ),
        db_session=db_session,
    )

    print(
        f"[CREATE] Permission: "
        f"{permission.name}"
    )

    return permission


# ============================================================================
# Roles
# ============================================================================


async def get_role(
    *,
    db_session,
    role_name: str,
) -> RoleModel | None:
    """Get an existing role by name."""

    role = await crud.role.get_role_by_name(
        name=role_name,
        db_session=db_session,
    )

    if role is None:
        print(
            f"[SKIP] Role does not exist: "
            f"{role_name}"
        )

    return role


async def assign_role_permissions(
    *,
    db_session,
    superuser,
    role: RoleModel,
    permissions: dict[str, PermissionModel],
) -> None:
    """Assign required permissions to a role."""

    required_permission_names = ROLE_PERMISSIONS[role.name]

    permission_ids = []

    for permission_name in required_permission_names:
        permission = permissions.get(permission_name)

        if permission is None:
            raise RuntimeError(
                f"Permission was not created/found: "
                f"{permission_name}"
            )

        permission_ids.append(permission.id)

    if not permission_ids:
        return

    await crud.role.assign_permissions(
        role_id=role.id,
        permission_ids=permission_ids,
        current_user=superuser,
        db_session=db_session,
    )

    print(
        f"[OK] Role updated: {role.name}"
    )

    for permission_name in sorted(required_permission_names):
        print(
            f"     + {permission_name}"
        )


# ============================================================================
# Migration
# ============================================================================


async def main() -> None:
    print("=" * 70)
    print("RAG COLLECTION PERMISSIONS MIGRATION")
    print("=" * 70)

    async with SessionLocal() as db_session:
        # --------------------------------------------------------------------
        # 1. Find migration actor
        # --------------------------------------------------------------------

        superuser = await crud.user.get_by_email(
            email=settings.FIRST_SUPERUSER_EMAIL,
            db_session=db_session,
        )

        if superuser is None:
            raise RuntimeError(
                "Initial superuser was not found: "
                f"{settings.FIRST_SUPERUSER_EMAIL}"
            )

        print(
            f"[OK] Migration actor: "
            f"{superuser.email}"
        )

        # --------------------------------------------------------------------
        # 2. Permission group
        # --------------------------------------------------------------------

        permission_group = await get_or_create_permission_group(
            db_session=db_session,
            superuser=superuser,
        )

        # --------------------------------------------------------------------
        # 3. Permissions
        # --------------------------------------------------------------------

        permissions: dict[str, PermissionModel] = {}

        for permission_name, description in COLLECTION_PERMISSIONS.items():
            permission = await get_or_create_permission(
                db_session=db_session,
                permission_group=permission_group,
                permission_name=permission_name,
                description=description,
            )

            permissions[permission_name] = permission

        # --------------------------------------------------------------------
        # 4. Assign permissions to roles
        # --------------------------------------------------------------------

        for role_name in ROLE_PERMISSIONS:
            role = await get_role(
                db_session=db_session,
                role_name=role_name,
            )

            if role is None:
                continue

            await assign_role_permissions(
                db_session=db_session,
                superuser=superuser,
                role=role,
                permissions=permissions,
            )

        # --------------------------------------------------------------------
        # 5. Commit
        # --------------------------------------------------------------------

        await db_session.commit()

        print()
        print("=" * 70)
        print("MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())