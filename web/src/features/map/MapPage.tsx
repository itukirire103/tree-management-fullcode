import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useNavigate } from "react-router";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { HEALTH_STATUS_COLORS } from "../../lib/types";
import type { TreeMapPoint } from "../../lib/types";
import { canCreateTree, canEditTree } from "../../lib/permissions";

const MINATO_CENTER: [number, number] = [35.6581, 139.7514]; // 港区役所付近
const DEFAULT_ZOOM = 15;

function healthColor(status: TreeMapPoint["healthStatus"]): string {
  return status ? HEALTH_STATUS_COLORS[status] : "#868e96";
}

function makeDivIcon(color: string): L.DivIcon {
  // Leafletのデフォルトpinアイコンはバンドラー環境で画像パス解決が壊れやすいため、
  // 使わずCSSで色付けした円形divIconにする(健全度による色分けも兼ねられる)。
  return L.divIcon({
    className: "tree-marker",
    html: `<span style="background:${color}"></span>`,
    iconSize: [16, 16],
  });
}

function BoundsWatcher({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => {
    onBoundsChange(map.getBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function NewTreeClickHandler({
  enabled,
  onCreate,
}: {
  enabled: boolean;
  onCreate: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      if (enabled) onCreate(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [points, setPoints] = useState<TreeMapPoint[]>([]);
  const fetchTimer = useRef<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const canCreate = user ? canCreateTree(user.role) : false;
  const canEdit = user ? canEditTree(user.role) : false;

  // 機能要件#33: スマートフォン等から位置情報を自動取得し、現在地に樹木を登録できるようにする。
  // 空き地クリックでの新規登録(NewTreeClickHandler)と同じ導線(/trees/new?latitude=..&longitude=..)
  // に位置情報だけ現在地から取得して合流させる。
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("この端末では位置情報を取得できません。");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        navigate(
          `/trees/new?latitude=${position.coords.latitude.toFixed(6)}&longitude=${position.coords.longitude.toFixed(6)}`
        );
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "位置情報の利用が許可されていません。ブラウザの設定を確認してください。"
            : "現在地を取得できませんでした。"
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [navigate]);

  const fetchPoints = useCallback((bounds: L.LatLngBounds) => {
    if (fetchTimer.current) window.clearTimeout(fetchTimer.current);
    fetchTimer.current = window.setTimeout(async () => {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const res = await api.get<{ data: TreeMapPoint[] }>("/trees/map", {
        params: { swLat: sw.lat, swLng: sw.lng, neLat: ne.lat, neLng: ne.lng },
      });
      setPoints(res.data.data);
    }, 300);
  }, []);

  const handleDragEnd = useCallback(async (id: string, lat: number, lng: number) => {
    await api.patch(`/trees/${id}/location`, { latitude: lat, longitude: lng });
  }, []);

  const markers = useMemo(
    () =>
      points.map((point) => (
        <Marker
          key={point.id}
          position={[Number(point.latitude), Number(point.longitude)]}
          icon={makeDivIcon(healthColor(point.healthStatus))}
          draggable={canEdit}
          eventHandlers={{
            click: () => navigate(`/trees/${point.id}`),
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const pos = marker.getLatLng();
              void handleDragEnd(point.id, pos.lat, pos.lng);
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {point.treeNumber}
          </Tooltip>
        </Marker>
      )),
    [points, canEdit, navigate, handleDragEnd]
  );

  return (
    <div className="map-page">
      <MapContainer center={MINATO_CENTER} zoom={DEFAULT_ZOOM} className="leaflet-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsWatcher onBoundsChange={fetchPoints} />
        <NewTreeClickHandler
          enabled={canCreate}
          onCreate={(lat, lng) => navigate(`/trees/new?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}`)}
        />
        <MarkerClusterGroup>{markers}</MarkerClusterGroup>
      </MapContainer>
      <div className="map-legend">
        <h3>健全度</h3>
        {Object.entries(HEALTH_STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="map-legend-item">
            <span className="map-legend-dot" style={{ background: color }} />
            {status}
          </div>
        ))}
        <div className="map-legend-item">
          <span className="map-legend-dot" style={{ background: "#868e96" }} />
          未診断
        </div>
      </div>
      {canCreate && (
        <p className="map-hint">地図上の空いている場所をクリックすると、その位置に新しい樹木を登録できます。</p>
      )}
      {canCreate && (
        <div className="map-geolocation">
          <button type="button" onClick={handleUseCurrentLocation} disabled={locating}>
            {locating ? "現在地を取得中..." : "📍 現在地に樹木を登録"}
          </button>
          {locationError && <p className="map-geolocation-error">{locationError}</p>}
        </div>
      )}
    </div>
  );
}
