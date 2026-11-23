import { clockInApi } from './apiClient';

export interface StartBreakPayload {
  breakType: 'MEAL' | 'REST';
  latitude?: number;
  longitude?: number;
  notes?: string;
  workspaceId?: string;
}

export interface EndBreakPayload {
  latitude?: number;
  longitude?: number;
  notes?: string;
  workspaceId?: string;
}

export interface WaiveMealPayload {
  reason: string;
  attestationConfirmed: true;
  workspaceId?: string;
}

export interface ActiveBreakData {
  id: string;
  breakType: 'MEAL' | 'REST';
  isPaid: boolean;
  startTime: string;
  elapsedMinutes: number;
  minimumRemainingMinutes: number;
}

export interface BreakComplianceData {
  policy: 'FEDERAL_STANDARD' | 'CALIFORNIA_STRICT' | 'CUSTOM';
  shiftStartTime: string;
  grossElapsedHours: number;
  firstMealDueBy: string;
  minutesUntilMealDue: number;
  isMealLate: boolean;
  mealWaiverSigned: boolean;
  canWaiveMeal: boolean;
}

export interface ShiftSummaryData {
  totalBreaksCount: number;
  mealBreaksCount: number;
  restBreaksCount: number;
  totalBreakMinutes: number;
  unpaidBreakMinutes: number;
  paidBreakMinutes: number;
  mealPenaltyHours: number;
  restPenaltyHours: number;
}

export interface BreakStatusResponse {
  isClockedIn: boolean;
  isOnBreak: boolean;
  activeBreak: ActiveBreakData | null;
  compliance: BreakComplianceData | null;
  shiftSummary: ShiftSummaryData | null;
}

export interface BreakHistoryItem {
  id: string;
  breakType: 'MEAL' | 'REST';
  isPaid: boolean;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  isCompliant: boolean;
  violationType: string;
  notes?: string | null;
}

export const breakService = {
  /**
   * Start an unpaid meal or paid rest break
   */
  async startBreak(payload: StartBreakPayload) {
    const res = await clockInApi.post<{ success: boolean; data: any; message: string }>(
      '/api/v1/attendance/break/start',
      payload
    );
    return res.data;
  },

  /**
   * End current active break
   */
  async endBreak(payload: EndBreakPayload = {}) {
    const res = await clockInApi.post<{ success: boolean; data: any; message: string }>(
      '/api/v1/attendance/break/end',
      payload
    );
    return res.data;
  },

  /**
   * Submit mutual meal waiver for shift <= 6.0 hours (California § 512)
   */
  async waiveMeal(payload: WaiveMealPayload) {
    const res = await clockInApi.post<{ success: boolean; data: any; message: string }>(
      '/api/v1/attendance/break/waive-meal',
      payload
    );
    return res.data;
  },

  /**
   * Get current active break status, remaining minutes and California compliance countdown
   */
  async getStatus(): Promise<BreakStatusResponse> {
    const res = await clockInApi.get<{ success: boolean; data: BreakStatusResponse }>(
      '/api/v1/attendance/break/status'
    );
    return res.data.data;
  },

  /**
   * Get break audit trail for a shift record
   */
  async getHistory(attendanceRecordId?: string): Promise<BreakHistoryItem[]> {
    const res = await clockInApi.get<{ success: boolean; data: BreakHistoryItem[] }>(
      '/api/v1/attendance/break/history',
      { params: { attendanceRecordId } }
    );
    return res.data.data;
  },
};
