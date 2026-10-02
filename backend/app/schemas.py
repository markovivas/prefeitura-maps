from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BuildingCreate(BaseModel):
    name: str = Field(..., example="Prefeitura Municipal de Três Corações")
    address: str = Field(..., example="Av. Brasil, 225 - Jardim América, Três Corações - MG")
    description: Optional[str] = ""
    latitude: float = Field(..., example=-21.67083)
    longitude: float = Field(..., example=-45.26903)
    footprint_geojson: Optional[Dict[str, Any]] = None


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FloorCreate(BaseModel):
    building_id: int = 1
    name: str = Field(..., example="2º Andar")
    level: int = Field(..., example=2)


class RoomCreate(BaseModel):
    floor_id: int = Field(..., example=1)
    code: str = Field(..., example="105")
    name: str = Field(..., example="Sala 105")
    department: str = Field(..., example="Ouvidoria Municipal")
    category: str = Field(default="service", example="service")
    description: Optional[str] = ""
    opening_hours: Optional[str] = "08:00 às 17:00"
    geometry: Optional[Dict[str, Any]] = None


class RoomUpdate(BaseModel):
    floor_id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    opening_hours: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None


class LoginRequest(BaseModel):
    username: str = Field(..., example="admin")
    password: str = Field(..., example="admin123")

