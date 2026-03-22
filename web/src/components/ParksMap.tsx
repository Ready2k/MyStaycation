'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths broken by webpack
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

interface Park {
    id: string;
    name: string;
    providerCode: string;
    providerName: string;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    parkCode: string | null;
}

interface ParksMapProps {
    parks: Park[];
    onWatchPark: (park: Park) => void;
}

const PROVIDER_COLOURS: Record<string, string> = {
    haven: '#2563eb',
    hoseasons: '#16a34a',
    centerparcs: '#059669',
    butlins: '#dc2626',
    parkdean: '#ea580c',
    awayresorts: '#9333ea',
};

function colourIcon(providerCode: string): L.Icon {
    const colour = PROVIDER_COLOURS[providerCode.toLowerCase()] ?? '#6b7280';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${colour}" stroke="white" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="5" fill="white"/>
    </svg>`;
    const url = `data:image/svg+xml;base64,${btoa(svg)}`;
    return L.icon({
        iconUrl: url,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
    });
}

export function ParksMap({ parks, onWatchPark }: ParksMapProps) {
    const mappable = parks.filter(p => p.latitude !== null && p.longitude !== null);

    return (
        <MapContainer
            center={[54.0, -2.0]}
            zoom={6}
            style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
            scrollWheelZoom={true}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mappable.map(park => (
                <Marker
                    key={park.id}
                    position={[park.latitude!, park.longitude!]}
                    icon={colourIcon(park.providerCode)}
                >
                    <Popup>
                        <div className="text-sm min-w-[160px]">
                            <p className="font-semibold text-gray-900">{park.name}</p>
                            <p className="text-gray-500 text-xs mb-2">{park.providerName}{park.region ? ` · ${park.region}` : ''}</p>
                            <button
                                onClick={() => onWatchPark(park)}
                                className="w-full text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                            >
                                + Create Watcher
                            </button>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
