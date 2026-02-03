import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const FitBounds = ({ coordinates }) => {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [coordinates, map]);
  return null;
};

export default FitBounds;
