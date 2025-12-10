import { NextRequest, NextResponse } from 'next/server';
import { EmployeeShortageService } from '@/services/Employee-Shortage';

export class EmployeeShortageController {
  private service = new EmployeeShortageService();

  async handleGet(request: NextRequest) {

    try {
     
      // Fetch from service
      const shortages = await this.service.getEmployeeShortages();

      return NextResponse.json(shortages, { status: 200 });
    } catch (err) {
      console.error('GET_EMPLOYEE_SHORTAGE_ERROR', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch employee shortages';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}