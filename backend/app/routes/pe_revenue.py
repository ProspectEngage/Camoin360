from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator

from .auth import require_user, user_has_module
from ..services.pe_revenue import add_payment, add_subscription, build_report, list_revenue_data


def require_revenue_access(user=Depends(require_user)):
    if not (user_has_module(user, "prospecting") or user_has_module(user, "management")):
        raise HTTPException(status_code=403, detail="PE revenue access required")
    return user


router = APIRouter(prefix="/pe-revenue", tags=["pe-revenue"], dependencies=[Depends(require_revenue_access)])


class SubscriptionCreate(BaseModel):
    organization_id: int = Field(gt=0)
    plan_name: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    billing_frequency: Literal["monthly", "annual"]
    status: Literal["active", "inactive", "canceled"]
    effective_from: date
    effective_to: date | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if not self.plan_name.strip():
            raise ValueError("Plan name is required")
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("End date must be on or after start date")
        return self


class PaymentCreate(BaseModel):
    organization_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    received_on: date
    period_start: date
    period_end: date
    reference: str = Field(default="", max_length=200)

    @model_validator(mode="after")
    def validate_period(self):
        if self.period_end < self.period_start:
            raise ValueError("Period end must be on or after period start")
        if self.received_on > date.today():
            raise ValueError("A received payment date cannot be in the future")
        return self


@router.get("")
def get_report(year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
               month: int | None = Query(default=None, ge=1, le=12)):
    return build_report(*list_revenue_data(), year, month)


@router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
def create_subscription(request: SubscriptionCreate):
    try:
        return add_subscription(request.organization_id, request.model_dump())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/payments", status_code=status.HTTP_201_CREATED)
def create_payment(request: PaymentCreate):
    try:
        return add_payment(request.organization_id, request.model_dump())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
