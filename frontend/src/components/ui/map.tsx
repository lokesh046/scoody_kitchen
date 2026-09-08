import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Map as MLMap,
  Marker as MLMarker,
  type FlyToOptions,
  type StyleSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, Compass, Locate, Loader2 } from 'lucide-react';

interface MapContextValue {
  map: MLMap | null;
  isLoaded: boolean;
}

const MapContext = createContext<MapContextValue>({
  map: null,
  isLoaded: false,
});

export const useMap = () => useContext(MapContext);

export interface MapRefHandle {
  getMap: () => MLMap | null;
  flyTo: (options: FlyToOptions) => void;
  setCenter: (center: [number, number]) => void;
}

export interface MapProps {
  center: [number, number]; // [lng, lat]
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  pitch?: number;
  bearing?: number;
  style?: string | StyleSpecification;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: (coords: { lng: number; lat: number }) => void;
  onMoveEnd?: (coords: { lng: number; lat: number; zoom: number }) => void;
}

// Default modern vector basemap style (CARTO Voyager — clean, modern, high-DPI vector tiles)
const DEFAULT_MAP_STYLE: string | StyleSpecification =
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

export const Map = forwardRef<MapRefHandle, MapProps>(
  (
    {
      center,
      zoom = 13,
      minZoom = 2,
      maxZoom = 19,
      pitch = 0,
      bearing = 0,
      style = DEFAULT_MAP_STYLE,
      interactive = true,
      className = 'w-full h-full min-h-[260px]',
      children,
      onClick,
      onMoveEnd,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MLMap | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
      flyTo: (options: FlyToOptions) => mapRef.current?.flyTo(options),
      setCenter: (c: [number, number]) => mapRef.current?.setCenter(c),
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const mapInstance = new MLMap({
        container: containerRef.current,
        style: style,
        center: center,
        zoom: zoom,
        minZoom: minZoom,
        maxZoom: maxZoom,
        pitch: pitch,
        bearing: bearing,
        interactive: interactive,
        attributionControl: false,
      });

      mapInstance.on('load', () => {
        setIsLoaded(true);
        mapInstance.resize();
      });

      if (onClick) {
        mapInstance.on('click', (e: MapLayerMouseEvent) => {
          onClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        });
      }

      if (onMoveEnd) {
        mapInstance.on('moveend', () => {
          const c = mapInstance.getCenter();
          onMoveEnd({ lng: c.lng, lat: c.lat, zoom: mapInstance.getZoom() });
        });
      }

      mapRef.current = mapInstance;

      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        mapInstance.remove();
        mapRef.current = null;
        setIsLoaded(false);
      };
    }, []);

    // Sync center dynamically if updated from outside
    useEffect(() => {
      if (!mapRef.current || !isLoaded) return;
      const currentCenter = mapRef.current.getCenter();
      const dist = Math.hypot(currentCenter.lng - center[0], currentCenter.lat - center[1]);
      if (dist > 0.0001) {
        mapRef.current.flyTo({
          center: center,
          essential: true,
          duration: 1200,
        });
      }
    }, [center[0], center[1], isLoaded]);

    return (
      <MapContext.Provider value={{ map: mapRef.current, isLoaded }}>
        <div className="relative w-full h-full">
          <div ref={containerRef} className={className} />
          {isLoaded && children}
        </div>
      </MapContext.Provider>
    );
  }
);

Map.displayName = 'Map';

/* -------------------------------------------------------------------------
 * MapMarker Component
 * ------------------------------------------------------------------------- */
export interface MapMarkerProps {
  position: [number, number]; // [lng, lat]
  draggable?: boolean;
  onDragEnd?: (coords: { lng: number; lat: number }) => void;
  onClick?: () => void;
  children?: React.ReactNode;
}

export const MapMarker: React.FC<MapMarkerProps> = ({
  position,
  draggable = false,
  onDragEnd,
  onClick,
  children,
}) => {
  const { map, isLoaded } = useMap();
  const markerRef = useRef<MLMarker | null>(null);
  const elementRef = useRef<HTMLDivElement>(document.createElement('div'));

  useEffect(() => {
    if (!map || !isLoaded) return;

    const marker = new MLMarker({
      element: elementRef.current,
      draggable: draggable,
    })
      .setLngLat(position)
      .addTo(map);

    if (draggable && onDragEnd) {
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        onDragEnd({ lng: lngLat.lng, lat: lngLat.lat });
      });
    }

    if (onClick) {
      const clickHandler = (e: MouseEvent) => {
        e.stopPropagation();
        onClick();
      };
      elementRef.current.addEventListener('click', clickHandler);
      return () => {
        elementRef.current.removeEventListener('click', clickHandler);
        marker.remove();
        markerRef.current = null;
      };
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, isLoaded, draggable]);

  // Update position when prop changes
  useEffect(() => {
    if (markerRef.current) {
      const currentPos = markerRef.current.getLngLat();
      if (
        Math.abs(currentPos.lng - position[0]) > 0.00001 ||
        Math.abs(currentPos.lat - position[1]) > 0.00001
      ) {
        markerRef.current.setLngLat(position);
      }
    }
  }, [position[0], position[1]]);

  return createPortal(children, elementRef.current);
};

/* -------------------------------------------------------------------------
 * MapControls Component (In-Map Floating Buttons, including "Locate Me")
 * ------------------------------------------------------------------------- */
export interface MapControlsProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showZoom?: boolean;
  showCompass?: boolean;
  showGeolocate?: boolean;
  isLocating?: boolean;
  onGeolocate?: (coords: { latitude: number; longitude: number }) => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  position = 'top-right',
  showZoom = true,
  showCompass = true,
  showGeolocate = true,
  isLocating = false,
  onGeolocate,
}) => {
  const { map } = useMap();
  const [internalLocating, setInternalLocating] = useState(false);

  const positionClasses = {
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3',
    'bottom-left': 'bottom-3 left-3',
    'bottom-right': 'bottom-3 right-3',
  }[position];

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map?.zoomIn();
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map?.zoomOut();
  };

  const handleResetCompass = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    map?.resetNorthPitch({ duration: 600 });
  };

  const handleLocateMe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onGeolocate) {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }
      setInternalLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setInternalLocating(false);
          const { latitude, longitude } = pos.coords;
          map?.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1500,
          });
          onGeolocate({ latitude, longitude });
        },
        (err) => {
          setInternalLocating(false);
          console.warn('In-map geolocate failed, attempting fallback...', err);
          fetch('https://freeipapi.com/api/json')
            .then((r) => r.json())
            .then((data) => {
              if (data.latitude && data.longitude) {
                map?.flyTo({
                  center: [data.longitude, data.latitude],
                  zoom: 14,
                  duration: 1500,
                });
                onGeolocate({ latitude: data.latitude, longitude: data.longitude });
              }
            })
            .catch((e) => console.error('IP geocode fallback failed', e));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const locatingActive = isLocating || internalLocating;

  return (
    <div
      className={`absolute ${positionClasses} z-10 flex flex-col gap-1.5 shadow-md bg-white/95 backdrop-blur-xs p-1 rounded-md border border-cardboard/30`}
    >
      {showGeolocate && (
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locatingActive}
          title="Locate Me (Current GPS)"
          className="p-2 text-ink hover:text-herb hover:bg-herb/10 rounded transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer group"
        >
          {locatingActive ? (
            <Loader2 className="w-4 h-4 animate-spin text-herb" />
          ) : (
            <Locate className="w-4 h-4 group-hover:scale-110 transition-transform text-herb" />
          )}
        </button>
      )}

      {showZoom && (
        <>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom in"
            className="p-2 text-ink hover:text-ink hover:bg-cardboard/15 rounded transition-colors flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom out"
            className="p-2 text-ink hover:text-ink hover:bg-cardboard/15 rounded transition-colors flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </>
      )}

      {showCompass && (
        <button
          type="button"
          onClick={handleResetCompass}
          title="Reset North orientation"
          className="p-2 text-ink hover:text-ink hover:bg-cardboard/15 rounded transition-colors flex items-center justify-center cursor-pointer"
        >
          <Compass className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------
 * MapRoute Component (Polyline rendering for delivery or clinic directions)
 * ------------------------------------------------------------------------- */
export interface MapRouteProps {
  id?: string;
  coordinates: [number, number][]; // Array of [lng, lat]
  color?: string;
  width?: number;
  opacity?: number;
}

export const MapRoute: React.FC<MapRouteProps> = ({
  id = 'route-layer',
  coordinates,
  color = '#22c55e',
  width = 4,
  opacity = 0.85,
}) => {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || coordinates.length === 0) return;

    const sourceId = `${id}-source`;
    const layerId = `${id}-line`;

    const geojsonData: any = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
    };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as GeoJSONSource).setData(geojsonData);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData,
      });

      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
        },
      });
    }

    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, isLoaded, id, coordinates, color, width, opacity]);

  return null;
};
