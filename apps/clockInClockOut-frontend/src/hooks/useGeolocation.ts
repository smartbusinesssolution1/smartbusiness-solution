import { useState, useCallback } from 'react';

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export const useGeolocation = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<GeolocationData | null>(null);

  const getPosition = useCallback((): Promise<GeolocationData> => {
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errorMsg = 'Geolocation is not supported by your browser.';
        setError(errorMsg);
        setLoading(false);
        reject(new Error(errorMsg));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      };

      const handleSuccess = (position: GeolocationPosition) => {
        const data: GeolocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setCoords(data);
        setLoading(false);
        resolve(data);
      };

      const handleError = (geoError: GeolocationPositionError) => {
        if (geoError.code !== geoError.PERMISSION_DENIED && options.enableHighAccuracy) {
          // Fall back to low accuracy
          console.warn('High accuracy geolocation failed. Falling back to standard accuracy.');
          options.enableHighAccuracy = false;
          options.timeout = 10000;
          navigator.geolocation.getCurrentPosition(handleSuccess, (secondError) => {
            let errorMsg = 'An unknown error occurred while retrieving location.';
            switch (secondError.code) {
              case secondError.PERMISSION_DENIED:
                errorMsg = 'Location permission is required to check in.';
                break;
              case secondError.POSITION_UNAVAILABLE:
                errorMsg = 'Location information is unavailable.';
                break;
              case secondError.TIMEOUT:
                errorMsg = 'The request to get user location timed out.';
                break;
            }
            setError(errorMsg);
            setLoading(false);
            reject(new Error(errorMsg));
          }, options);
        } else {
          let errorMsg = 'An unknown error occurred while retrieving location.';
          switch (geoError.code) {
            case geoError.PERMISSION_DENIED:
              errorMsg = 'Location permission is required to check in.';
              break;
            case geoError.POSITION_UNAVAILABLE:
              errorMsg = 'Location information is unavailable.';
              break;
            case geoError.TIMEOUT:
              errorMsg = 'The request to get user location timed out.';
              break;
          }
          setError(errorMsg);
          setLoading(false);
          reject(new Error(errorMsg));
        }
      };

      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
    });
  }, []);

  return {
    getPosition,
    coords,
    loading,
    error,
    setError,
  };
};

export default useGeolocation;
