from dataclasses import dataclass


@dataclass(frozen=True)
class Organization:
    id: int
    dynamics_account_id: str
    organization_name: str
    city: str
    state: str
    user_count: int
    contract_expiration: str | None
    created_at: str
    updated_at: str
    number_of_users: int | None = None
    usage_type: str | None = None

    @classmethod
    def from_row(cls, row):
        return cls(**dict(row))
