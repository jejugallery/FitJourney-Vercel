// Frontend API Service Layer for FitJourney Vercel + Neon Migration



function toCamel(s: string): string {
  return s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
}

function toCamelCaseKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(toCamelCaseKeys);
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj;
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const camelKey = toCamel(key);
      result[camelKey] = toCamelCaseKeys(obj[key]);
    }
    return result;
  }
  return obj;
}

// Generic fetch wrapper
async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  return toCamelCaseKeys(data) as T;
}

// 1. Appointments (ระบบนัดหมาย)
export const appointmentsApi = {
  list: () => request<any[]>('/api/appointments'),
  get: (id: string) => request<any>(`/api/appointments?id=${id}`),
  create: (data: any) => request<any>('/api/appointments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/appointments?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/appointments?id=${id}`, { method: 'DELETE' }),
};

// 2. Appointment Invitations (คำเชิญนัดหมาย)
export const appointmentInvitationsApi = {
  listForUser: (inviteeId: string) => request<any[]>(`/api/appointment-invitations?inviteeId=${inviteeId}`),
  listForAppointment: (appointmentId: string) => request<any[]>(`/api/appointment-invitations?appointmentId=${appointmentId}`),
  getPendingCount: (inviteeId: string) => request<{ count: number }>(`/api/appointment-invitations?inviteeId=${inviteeId}&status=pending&countOnly=true`),
  create: (data: any) => request<any>('/api/appointment-invitations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { status?: string; viewed?: boolean }) => 
    request<any>(`/api/appointment-invitations?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteForAppointment: (appointmentId: string) => request<any>(`/api/appointment-invitations?appointmentId=${appointmentId}`, { method: 'DELETE' }),
  delete: (id: string) => request<any>(`/api/appointment-invitations?id=${id}`, { method: 'DELETE' }),
};

// 3. Events (ระบบกิจกรรม)
export const eventsApi = {
  list: () => request<any[]>('/api/events'),
  get: (id: string) => request<any>(`/api/events?id=${id}`),
  create: (data: any) => request<any>('/api/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/events?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/events?id=${id}`, { method: 'DELETE' }),
};

// 4. Event Invitations (คำเชิญร่วมกิจกรรม)
export const eventInvitationsApi = {
  listForUser: (inviteeId: string) => request<any[]>(`/api/event-invitations?inviteeId=${inviteeId}`),
  listForEvent: (eventId: string) => request<any[]>(`/api/event-invitations?eventId=${eventId}`),
  getPendingCount: (inviteeId: string) => request<{ count: number }>(`/api/event-invitations?inviteeId=${inviteeId}&status=pending&countOnly=true`),
  create: (data: any) => request<any>('/api/event-invitations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { status?: string; viewed?: boolean }) => 
    request<any>(`/api/event-invitations?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteForEvent: (eventId: string) => request<any>(`/api/event-invitations?eventId=${eventId}`, { method: 'DELETE' }),
  delete: (id: string) => request<any>(`/api/event-invitations?id=${id}`, { method: 'DELETE' }),
};

// 5. Event RSVPs (การลงชื่อเข้าร่วมกิจกรรม)
export const eventRsvpsApi = {
  list: (eventId: string) => request<any[]>(`/api/event-rsvps?eventId=${eventId}`),
  check: (eventId: string, userId: string) => request<{ exists: boolean; data: any | null }>(`/api/event-rsvps?eventId=${eventId}&userId=${userId}`),
  join: (data: { eventId: string; userId: string; displayName: string; pictureUrl: string }) => 
    request<any>('/api/event-rsvps', { method: 'POST', body: JSON.stringify(data) }),
  withdraw: (eventId: string, userId: string) => 
    request<any>(`/api/event-rsvps?eventId=${eventId}&userId=${userId}`, { method: 'DELETE' }),
};

// 6. Billings (ระบบเรียกเก็บเงิน)
export const billingsApi = {
  list: () => request<any[]>('/api/billings'),
  get: (id: string) => request<any>(`/api/billings?id=${id}`),
  create: (data: any) => request<any>('/api/billings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/billings?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// 7. Billing Payments (การชำระเงินและสลิป)
export const billingPaymentsApi = {
  list: (billingId: string) => request<any[]>(`/api/billing-payments?billingId=${billingId}`),
  get: (billingId: string, userId: string) => request<any | null>(`/api/billing-payments?billingId=${billingId}&userId=${userId}`),
  submit: (data: any) => request<any>('/api/billing-payments', { method: 'POST', body: JSON.stringify(data) }),
};

// 8. Used Slips (ตรวจสอบสลิปซ้ำ)
export const usedSlipsApi = {
  check: (slipId: string) => request<{ exists: boolean; data: any | null }>(`/api/used-slips?slipId=${encodeURIComponent(slipId)}`),
  register: (data: { slipId: string; billingId: string; userId: string; slipUrl: string }) => 
    request<any>('/api/used-slips', { method: 'POST', body: JSON.stringify(data) }),
};

// 9. Saved Bank Accounts (บันทึกบัญชีรับเงิน)
export const savedAccountsApi = {
  list: (userId: string) => request<any[]>(`/api/saved-bank-accounts?userId=${userId}`),
  save: (data: { id: string; userId: string; accountName: string; bankName: string; accountNumber: string }) => 
    request<any>('/api/saved-bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
};

// 10. Health Knowledges (คลังความรู้)
export const healthKnowledgesApi = {
  list: () => request<any[]>('/api/health-knowledges'),
  get: (id: string) => request<any>(`/api/health-knowledges?id=${id}`),
  create: (data: any) => request<any>('/api/health-knowledges', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/health-knowledges?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/health-knowledges?id=${id}`, { method: 'DELETE' }),
};

// 11. Knowledge Notes (โน้ตของคลังความรู้)
export const knowledgeNotesApi = {
  list: (knowledgeId: string) => request<any[]>(`/api/knowledge-notes?knowledgeId=${knowledgeId}`),
  create: (data: { knowledgeId: string; userId: string; displayName: string; pictureUrl: string; note: string }) => 
    request<any>('/api/knowledge-notes', { method: 'POST', body: JSON.stringify(data) }),
};
