"""One-time migration for RAG document RBAC permissions (idempotent).

    rag.documents.read
    rag.documents.write

Role mapping:
    User:    rag.documents.read
    Manager: rag.documents.read, rag.documents.write
"""

from __future__ import annotations

import asyncio

from app import crud
from app.core.config import settings
from app.db.session import SessionLocal
from app.schemas.users.permission_group_schema import IPermissionGroupCreate
from app.schemas.users.permission_schema import IPermissionCreate

PERMISSION_GROUP_NAME = "RAG Documents"

DOCUMENT_PERMISSIONS = {
    "rag.documents.read": "Read RAG documents.",
    "rag.documents.write": "Upload/modify/delete RAG documents.",
}

ROLE_PERMISSIONS = {
    "User": {"rag.documents.read"},
    "Manager": {"rag.documents.read", "rag.documents.write"},
}


async def main() -> None:
    async with SessionLocal() as db:
        superuser = await crud.user.get_by_email(
            email=settings.FIRST_SUPERUSER_EMAIL, db_session=db
        )
        if superuser is None:
            raise RuntimeError(f"Superuser not found: {settings.FIRST_SUPERUSER_EMAIL}")

        # 1. Group
        group = await crud.permission_group.get_by_name(
            name=PERMISSION_GROUP_NAME, db_session=db
        )
        if group is None:
            group = await crud.permission_group.create(
                obj_in=IPermissionGroupCreate(
                    name=PERMISSION_GROUP_NAME,
                    description="Global RBAC permissions for RAG documents.",
                    created_by_id=superuser.id,
                ),
                db_session=db,
            )
            print(f"[CREATE] Group: {group.name}")

        # 2. Permissions
        permissions = {}
        for name, description in DOCUMENT_PERMISSIONS.items():
            perm = await crud.permission.get_by_name(name=name, db_session=db)
            if perm is None:
                perm = await crud.permission.create(
                    obj_in=IPermissionCreate(
                        name=name, description=description, group_id=group.id
                    ),
                    db_session=db,
                )
                print(f"[CREATE] Permission: {name}")
            permissions[name] = perm

        # 3. Roles
        for role_name, perm_names in ROLE_PERMISSIONS.items():
            role = await crud.role.get_role_by_name(name=role_name, db_session=db)
            if role is None:
                print(f"[SKIP] Role not found: {role_name}")
                continue

            await crud.role.assign_permissions(
                role_id=role.id,
                permission_ids=[permissions[n].id for n in perm_names],
                current_user=superuser,
                db_session=db,
            )
            print(f"[OK] {role_name}: {sorted(perm_names)}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())