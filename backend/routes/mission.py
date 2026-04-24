from fastapi import APIRouter, HTTPException

from backend.schemas.mission import MissionCSPRequest, MissionCSPResponse, RescueLeg

router = APIRouter()


@router.post("/solve-mission-csp", response_model=MissionCSPResponse)
def solve_mission_csp(request: MissionCSPRequest):
    try:
        first_victim = request.victims[0]
        base = request.base
        first_location = first_victim.location

        outbound_leg = RescueLeg(
            from_point=base,
            to_point=first_location,
            victim_id=first_victim.id,
            path=[base, first_location],
            leg_cost=0.0,
        )
        return_leg = RescueLeg(
            from_point=first_location,
            to_point=base,
            victim_id=None,
            path=[first_location, base],
            leg_cost=0.0,
        )

        return MissionCSPResponse(
            success=False,
            message="STUB — CSP solver not yet implemented",
            rescue_order=[first_victim.id],
            skipped_victims=[victim.id for victim in request.victims[1:]],
            legs=[outbound_leg, return_leg],
            full_path=[base, first_location, base],
            total_cost=0.0,
            battery_used=0,
            battery_remaining=request.battery_limit,
            solver_stats={"stub": True},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
