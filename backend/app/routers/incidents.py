from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Incident, IncidentStatus, ThreatLevel
from app.services.mappers import map_incident

router = APIRouter(prefix="/api/v1/incidents", tags=["incidents"])


@router.get("/{incident_id}")
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"incident": map_incident(incident)}


@router.patch("/{incident_id}")
async def update_incident(incident_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if "status" in body and body["status"]:
        incident.status = IncidentStatus(body["status"])
    if "resolution" in body:
        incident.resolution = body["resolution"]
    if "assignedTo" in body:
        incident.assignedTo = body["assignedTo"]
    if "description" in body and body["description"]:
        incident.description = body["description"]
    if "location" in body and body["location"]:
        incident.location = body["location"]
    if "threatLevel" in body and body["threatLevel"]:
        incident.threatLevel = ThreatLevel(str(body["threatLevel"]).lower())

    await db.commit()
    await db.refresh(incident)
    return {"incident": map_incident(incident)}
