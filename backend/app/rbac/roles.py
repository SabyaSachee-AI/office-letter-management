class Roles:
    SYSTEM_ADMIN = "System Admin"
    RECEIVING_OFFICER = "Receiving Officer"
    APPROVAL_HEAD_PEC = "Approval Head-PEC"
    TEAM_LEADER = "Team Leader"
    CONSULTANT = "Consultant"

    # Backward-compatible aliases (same string as canonical where renamed)
    ADMIN = SYSTEM_ADMIN
    APPROVAL_HEAD = APPROVAL_HEAD_PEC


# Ordered for dropdowns / Role Management
ALL_ROLES: tuple[str, ...] = (
    Roles.RECEIVING_OFFICER,
    Roles.APPROVAL_HEAD_PEC,
    Roles.TEAM_LEADER,
    Roles.CONSULTANT,
    Roles.SYSTEM_ADMIN,
)

# Legacy DB / token values still accepted by guards
LEGACY_ROLE_NAMES: dict[str, frozenset[str]] = {
    Roles.SYSTEM_ADMIN: frozenset({Roles.SYSTEM_ADMIN, "Admin"}),
    Roles.APPROVAL_HEAD_PEC: frozenset({Roles.APPROVAL_HEAD_PEC, "Approval Head"}),
    Roles.RECEIVING_OFFICER: frozenset({Roles.RECEIVING_OFFICER}),
    Roles.TEAM_LEADER: frozenset({Roles.TEAM_LEADER}),
    Roles.CONSULTANT: frozenset({Roles.CONSULTANT}),
}


def expand_role_names(*allowed: str) -> set[str]:
    out: set[str] = set()
    for name in allowed:
        found = False
        for _, variants in LEGACY_ROLE_NAMES.items():
            if name in variants:
                out.update(variants)
                found = True
                break
        if not found:
            out.add(name)
    return out


def user_role_names(user) -> set[str]:
    return {r.name for r in user.roles}


def is_system_admin(user) -> bool:
    return bool(user_role_names(user) & LEGACY_ROLE_NAMES[Roles.SYSTEM_ADMIN])


def has_role_name(user, canonical_role: str) -> bool:
    variants = LEGACY_ROLE_NAMES.get(canonical_role, frozenset({canonical_role}))
    return bool(user_role_names(user) & variants)
