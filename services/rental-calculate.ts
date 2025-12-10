type BusType = 'Aircon' | 'Non-Aircon';

interface CalculateRequest {
  busType: BusType;
  duration: number;
  distance: number;
  passengers: number;
}

interface PriceBreakdown {
  baseRate: number;
  durationFee: number;
  distanceFee: number;
  extraFees: number;
  total: number;
}

interface CalculationResult {
  success: boolean;
  priceBreakdown: PriceBreakdown;
  calculation: {
    busType: BusType;
    duration: number;
    distance: number;
    passengers: number;
  };
}

const PRICING_CONFIG = {
  Aircon: { baseRate: 5000 },
  'Non-Aircon': { baseRate: 3000 },
  durationFeePerDay: 1000,
  distanceFeePerKm: 10,
  extraPassengerThreshold: 40,
  extraPassengerFee: 500,
};

export class RentalCalculateService {
  private validateBusType(busType: string): busType is BusType {
    return ['Aircon', 'Non-Aircon'].includes(busType);
  }

  private validateInput(duration: any, distance: any, passengers: any): { valid: boolean; error?: string } {
    const d = Math.max(0, parseInt(String(duration), 10) || 0);
    const dist = Math.max(0, parseInt(String(distance), 10) || 0);
    const pax = Math.max(0, parseInt(String(passengers), 10) || 0);

    if (d <= 0) return { valid: false, error: 'Duration must be greater than 0' };
    if (dist <= 0) return { valid: false, error: 'Distance must be greater than 0' };
    if (pax <= 0) return { valid: false, error: 'Passengers must be greater than 0' };

    return { valid: true };
  }

  private parseNumericInputs(duration: any, distance: any, passengers: any): {
    duration: number;
    distance: number;
    passengers: number;
  } {
    return {
      duration: Math.max(0, parseInt(String(duration), 10) || 0),
      distance: Math.max(0, parseInt(String(distance), 10) || 0),
      passengers: Math.max(0, parseInt(String(passengers), 10) || 0),
    };
  }

  private calculatePriceBreakdown(
    busType: BusType,
    duration: number,
    distance: number,
    passengers: number
  ): PriceBreakdown {
    const baseRate = PRICING_CONFIG[busType].baseRate;
    const durationFee = duration * PRICING_CONFIG.durationFeePerDay;
    const distanceFee = distance * PRICING_CONFIG.distanceFeePerKm;
    const extraFees = passengers > PRICING_CONFIG.extraPassengerThreshold
      ? PRICING_CONFIG.extraPassengerFee
      : 0;

    const total = baseRate + durationFee + distanceFee + extraFees;

    return {
      baseRate,
      durationFee,
      distanceFee,
      extraFees,
      total,
    };
  }

  async calculateRentalPrice(request: {
    busType: any;
    duration: any;
    distance: any;
    passengers: any;
  }): Promise<CalculationResult> {
    const { busType, duration, distance, passengers } = request;

    // Validate bus type
    if (!this.validateBusType(busType)) {
      throw new Error('Invalid busType. Must be "Aircon" or "Non-Aircon"');
    }

    // Validate numeric inputs
    const validation = this.validateInput(duration, distance, passengers);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid input');
    }

    // Parse inputs
    const { duration: d, distance: dist, passengers: pax } = this.parseNumericInputs(
      duration,
      distance,
      passengers
    );

    // Calculate price breakdown
    const priceBreakdown = this.calculatePriceBreakdown(busType, d, dist, pax);

    return {
      success: true,
      priceBreakdown,
      calculation: {
        busType,
        duration: d,
        distance: dist,
        passengers: pax,
      },
    };
  }
}