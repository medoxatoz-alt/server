'use client';

import { useCallback, useState } from 'react';

export interface ParsedAddress {
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
}

interface UseGeolocatedAddressOptions {
  onError?: (message: string) => void;
}

// Shared browser-geolocation + Nominatim reverse-geocode logic used by the
// checkout form, the account address form, and the navbar location picker.
export function useGeolocatedAddress(options: UseGeolocatedAddressOptions = {}) {
  const [detecting, setDetecting] = useState(false);

  const detect = useCallback((): Promise<ParsedAddress> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Geolocation is not supported by your browser';
        options.onError?.(msg);
        reject(new Error(msg));
        return;
      }
      setDetecting(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            const address = data.address || {};

            const parts = [
              address.road || address.pedestrian || '',
              address.suburb || address.neighbourhood || address.residential || '',
            ].filter(Boolean);

            const parsed: ParsedAddress = {
              streetAddress: parts.join(', '),
              city: address.city || address.town || address.village || address.suburb || address.county || '',
              state: address.state || '',
              pincode: address.postcode || '',
            };
            setDetecting(false);
            resolve(parsed);
          } catch (err) {
            setDetecting(false);
            options.onError?.('Failed to resolve location details.');
            reject(err);
          }
        },
        () => {
          setDetecting(false);
          options.onError?.('Location access denied or unavailable.');
          reject(new Error('Location access denied or unavailable.'));
        }
      );
    });
  }, [options.onError]);

  return { detect, detecting };
}
