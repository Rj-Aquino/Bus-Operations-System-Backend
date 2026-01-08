import prisma from '@/client';

const VICINITY_RADIUS_KM = 50; // 50km radius from saved locations

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if coordinates are on water/sea using a simple heuristic
 * This is a basic check - for production, use a proper geocoding API
 */
function isLikelyWater(lat: number, lng: number): boolean {
  // Philippines land boundaries (very rough approximation)
  // Latitude: 4.5°N to 21°N
  // Longitude: 116°E to 127°E
  
  if (lat < 4.5 || lat > 21 || lng < 116 || lng > 127) {
    return true; // Outside Philippines bounds
  }
  
  // Additional checks for known water bodies can be added here
  // For now, we'll rely on the saved locations check
  return false;
}

/**
 * Validate if coordinates are within service vicinity
 * Returns { isValid: boolean, reason?: string }
 */
export async function validateVicinity(
  lat: number, 
  lng: number,
  locationType: 'pickup' | 'destination'
): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Check if coordinates are on water
    if (isLikelyWater(lat, lng)) {
      return {
        isValid: false,
        reason: `${locationType === 'pickup' ? 'Pickup' : 'Destination'} location appears to be in water or outside service area`
      };
    }

    // Get all saved stops from database
    const savedStops = await prisma.stop.findMany({
      where: { IsDeleted: false },
      select: { latitude: true, longitude: true }
    });
    
    if (savedStops.length === 0) {
      // If no saved stops exist, allow any valid land coordinates
      console.warn('No saved stops found. Allowing all land coordinates.');
      return { isValid: true };
    }

    // Check if coordinates match any saved stop (within 1km precision)
    const isExactMatch = savedStops.some(stop => {
      const distance = calculateDistance(lat, lng, Number(stop.latitude), Number(stop.longitude));
      return distance < 1; // Within 1km is considered a match
    });

    if (isExactMatch) {
      return { isValid: true };
    }

    // Check if coordinates are within vicinity radius of any saved stop
    const isWithinVicinity = savedStops.some(stop => {
      const distance = calculateDistance(lat, lng, Number(stop.latitude), Number(stop.longitude));
      return distance <= VICINITY_RADIUS_KM;
    });

    if (!isWithinVicinity) {
      return {
        isValid: false,
        reason: `${locationType === 'pickup' ? 'Pickup' : 'Destination'} location is outside our service vicinity (must be within ${VICINITY_RADIUS_KM}km of our service locations)`
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating vicinity:', error);
    // In case of error, allow the request to go through for manual review
    return { isValid: true };
  }
}

/**
 * Validate both pickup and destination coordinates
 */
export async function validateRequestLocations(
  pickupLat: number,
  pickupLng: number,
  destLat: number,
  destLng: number
): Promise<{ isValid: boolean; reasons: string[] }> {
  const pickupValidation = await validateVicinity(pickupLat, pickupLng, 'pickup');
  const destValidation = await validateVicinity(destLat, destLng, 'destination');

  const reasons: string[] = [];
  if (!pickupValidation.isValid && pickupValidation.reason) {
    reasons.push(pickupValidation.reason);
  }
  if (!destValidation.isValid && destValidation.reason) {
    reasons.push(destValidation.reason);
  }

  return {
    isValid: pickupValidation.isValid && destValidation.isValid,
    reasons
  };
}
