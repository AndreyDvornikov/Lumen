"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

const points = [
  { name: "The Hollow Spire", coords: [51.505, -0.09] as [number, number] },
  { name: "Archive of Silent Suns", coords: [51.51, -0.1] as [number, number] },
  { name: "Lantern Bastion", coords: [51.507, -0.08] as [number, number] },
];

export function CampaignMap() {
  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-[320px] w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => (
        <Marker key={point.name} position={point.coords}>
          <Popup>{point.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
