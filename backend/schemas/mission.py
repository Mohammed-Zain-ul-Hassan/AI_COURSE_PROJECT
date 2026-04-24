from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class Victim(BaseModel):
    id: str
    location: list[int]
    priority: int = Field(ge=1, le=3, description="1=Critical, 2=Urgent, 3=Stable")
    rescue_cost: int = Field(default=5, ge=0)

    @field_validator("location")
    @classmethod
    def location_must_be_pair(cls, v):
        if len(v) != 2:
            raise ValueError("location must be [row, col] pair")
        return v


class MissionCSPRequest(BaseModel):
    grid: list[list[int]]
    base: list[int]
    victims: list[Victim] = Field(min_length=1)
    battery_limit: int = Field(gt=0)
    max_victims_to_rescue: Optional[int] = None
    must_rescue_critical: bool = True
    allow_diagonal: bool = True

    @field_validator("grid")
    @classmethod
    def grid_must_be_rectangular(cls, v):
        if not v or not v[0]:
            raise ValueError("Grid must be a non-empty 2D array")
        row_length = len(v[0])
        if any(len(row) != row_length for row in v):
            raise ValueError("Grid must be rectangular")
        return v

    @field_validator("base")
    @classmethod
    def base_must_be_pair(cls, v):
        if len(v) != 2:
            raise ValueError("base must be [row, col] pair")
        return v

    @model_validator(mode="after")
    def validate_mission(self):
        rows = len(self.grid)
        cols = len(self.grid[0])

        br, bc = self.base
        if not (0 <= br < rows and 0 <= bc < cols):
            raise ValueError("base must be within grid bounds")
        if self.grid[br][bc] == 3:
            raise ValueError("base cannot be on wall/impassable cell")

        victim_ids = [victim.id for victim in self.victims]
        if len(victim_ids) != len(set(victim_ids)):
            raise ValueError("victim IDs must be unique")

        for victim in self.victims:
            vr, vc = victim.location
            if not (0 <= vr < rows and 0 <= vc < cols):
                raise ValueError(f"victim {victim.id} location must be within grid bounds")
            if self.grid[vr][vc] == 3:
                raise ValueError(f"victim {victim.id} cannot be on wall/impassable cell")

        return self


class RescueLeg(BaseModel):
    from_point: list[int]
    to_point: list[int]
    victim_id: Optional[str]
    path: list[list[int]]
    leg_cost: float


class MissionCSPResponse(BaseModel):
    success: bool
    message: str
    rescue_order: list[str] = Field(default_factory=list)
    skipped_victims: list[str] = Field(default_factory=list)
    legs: list[RescueLeg] = Field(default_factory=list)
    full_path: list[list[int]] = Field(default_factory=list)
    total_cost: float = 0.0
    battery_used: int = 0
    battery_remaining: int = 0
    solver_stats: dict = Field(default_factory=dict)
