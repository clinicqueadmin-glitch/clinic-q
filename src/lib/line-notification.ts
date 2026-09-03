/**
 * LINE Notification Service
 * สำหรับส่งข้อความแจ้งเตือนคิวคนไข้ผ่าน LINE Official Account
 */

// LINE API Configuration
interface LineConfig {
  channelAccessToken: string;
  channelSecret: string;
}

// LINE User Profile (เก็บจาก Webhook)
export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  phoneNumber?: string; // เบอร์โทรที่เชื่อมกับ LINE
  clinicId: string;
  createdAt: Date;
}

// Message Template for Queue Notification
interface QueueNotificationMessage {
  queueNumber: string;
  patientName: string;
  roomNumber?: number;
  practitionerName?: string;
  estimatedWaitMinutes?: number;
  status: 'called' | 'serving' | 'completed' | 'cancelled';
}

// ข้อความแจ้งเตือนตามสถานะ
const MESSAGE_TEMPLATES = {
  called: (data: QueueNotificationMessage) => ({
    type: 'flex' as const,
    altText: `🔔 แจ้งเตือนคิว ${data.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: '🔔 แจ้งเตือนคิว', weight: 'bold', size: 'lg' }],
        backgroundColor: '#06c755',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `สวัสดีค่ะ คุณ${data.patientName}`, size: 'md', wrap: true },
          { type: 'text', text: 'ถึงคิวของคุณแล้วค่ะ!', size: 'md', weight: 'bold', margin: 'md', color: '#06C755' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: 'คิว', size: 'sm', flex: 2 }, { type: 'text', text: data.queueNumber, size: 'sm', weight: 'bold', flex: 3 }] },
              ...(data.roomNumber ? [{ type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: 'ห้อง', size: 'sm', flex: 2 }, { type: 'text', text: `ห้อง ${data.roomNumber}`, size: 'sm', weight: 'bold', flex: 3 }] }] : []),
              ...(data.practitionerName ? [{ type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: 'ผู้ทำหัตถการ', size: 'sm', flex: 2 }, { type: 'text', text: data.practitionerName, size: 'sm', weight: 'bold', flex: 3 }] }] : []),
            ],
            backgroundColor: '#F5F5F5',
            cornerRadius: 'md',
            paddingAll: '12px',
          },
          { type: 'text', text: 'กรุณาเข้าห้องตรวจภายใน 5 นาที', size: 'xs', color: '#999999', margin: 'md', align: 'center' },
        ],
      },
    },
  }),

  serving: (data: QueueNotificationMessage) => ({
    type: 'flex' as const,
    altText: `⏳ กำลังให้บริการคิว ${data.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: '⏳ กำลังให้บริการ', weight: 'bold', size: 'lg' }],
        backgroundColor: '#0066CC',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `คิว ${data.queueNumber} กำลังให้บริการ`, size: 'md', wrap: true },
          { type: 'text', text: 'กรุณารอสักครู่ค่ะ', size: 'sm', color: '#666666', margin: 'sm' },
        ],
      },
    },
  }),

  completed: (data: QueueNotificationMessage) => ({
    type: 'flex' as const,
    altText: `✅ คิว ${data.queueNumber} เสร็จสิ้น`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: '✅ เสร็จสิ้น', weight: 'bold', size: 'lg' }],
        backgroundColor: '#06C755',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `คิว ${data.queueNumber} เสร็จสิ้นแล้วค่ะ`, size: 'md', wrap: true },
          { type: 'text', text: 'ขอบคุณที่มาใช้บริการค่ะ', size: 'sm', color: '#666666', margin: 'sm' },
        ],
      },
    },
  }),

  cancelled: (data: QueueNotificationMessage) => ({
    type: 'flex' as const,
    altText: `❌ คิว ${data.queueNumber} ถูกยกเลิก`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: '❌ ยกเลิกคิว', weight: 'bold', size: 'lg' }],
        backgroundColor: '#FF3344',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `คิว ${data.queueNumber} ถูกยกเลิกแล้วค่ะ`, size: 'md', wrap: true },
          { type: 'text', text: 'กรุณาติดต่อเจ้าหน้าที่ที่เคาน์เตอร์', size: 'sm', color: '#666666', margin: 'sm' },
        ],
      },
    },
  }),
};

/**
 * ดึงการตั้งค่า LINE จาก localStorage (clinic-specific)
 */
export function getLineSettings(clinicId?: string): LineConfig | null {
  if (typeof window === 'undefined') return null;
  
  // Try clinic-specific key first, then shared key
  const keys = clinicId ? [`clinic-q-line-settings-${clinicId}`, 'clinic-q-line-settings'] : ['clinic-q-line-settings'];
  for (const key of keys) {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.channelToken && parsed.channelSecret && parsed.enabled) {
          return {
            channelAccessToken: parsed.channelToken,
            channelSecret: parsed.channelSecret,
          };
        }
      } catch {}
    }
  }
  
  return null;
}

/**
 * ดึง LINE User ID จากหมายเลขโทรศัพท์ (clinic-specific)
 */
export function getLineUserId(phone: string, clinicId?: string): string | null {
  if (typeof window === 'undefined') return null;
  
  const keys = clinicId ? [`clinic-q-line-users-${clinicId}`, 'clinic-q-line-users'] : ['clinic-q-line-users'];
  for (const key of keys) {
    const lineUsers = localStorage.getItem(key);
    if (lineUsers) {
      try {
        const users: LineUserProfile[] = JSON.parse(lineUsers);
        const normalizedPhone = phone.replace(/-/g, '');
        const user = users.find(u => u.phoneNumber?.replace(/-/g, '') === normalizedPhone);
        return user?.userId || null;
      } catch {}
    }
  }
  return null;
}

/**
 * บันทึก LINE User Profile (clinic-specific)
 */
export function saveLineUserProfile(profile: LineUserProfile, clinicId?: string): void {
  if (typeof window === 'undefined') return;
  
  const storageKey = clinicId ? `clinic-q-line-users-${clinicId}` : 'clinic-q-line-users';
  const lineUsers = localStorage.getItem(storageKey);
  const users: LineUserProfile[] = lineUsers ? JSON.parse(lineUsers) : [];
  
  const existingIndex = users.findIndex(u => u.userId === profile.userId);
  if (existingIndex >= 0) {
    users[existingIndex] = profile;
  } else {
    users.push(profile);
  }
  
  localStorage.setItem(storageKey, JSON.stringify(users));
}

/**
 * ส่งข้อความแจ้งเตือนไปยัง LINE
 */
export async function sendLineNotification(
  userId: string,
  message: ReturnType<typeof MESSAGE_TEMPLATES[keyof typeof MESSAGE_TEMPLATES]>
): Promise<boolean> {
  const config = getLineSettings();
  if (!config) {
    console.error('LINE configuration not found');
    return false;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [message],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('LINE API Error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send LINE notification:', error);
    return false;
  }
}

/**
 * ส่งข้อความแจ้งเตือนคิว
 */
export async function sendQueueNotification(
  phone: string,
  data: QueueNotificationMessage
): Promise<boolean> {
  const lineUserId = getLineUserId(phone);
  if (!lineUserId) {
    console.log(`No LINE user found for phone: ${phone}`);
    return false;
  }

  const message = MESSAGE_TEMPLATES[data.status](data);
  return sendLineNotification(lineUserId, message);
}

/**
 * ส่งข้อความแจ้งเตือนเมื่อถึงคิว (แบบ ready)
 */
export async function sendQueueCalledNotification(
  phone: string,
  queueNumber: string,
  patientName: string,
  roomNumber?: number,
  practitionerName?: string
): Promise<boolean> {
  return sendQueueNotification(phone, {
    queueNumber,
    patientName,
    roomNumber,
    practitionerName,
    status: 'called',
  });
}

/**
 * ส่งข้อความแจ้งเตือนเมื่อกำลังให้บริการ
 */
export async function sendQueueServingNotification(
  phone: string,
  queueNumber: string,
  patientName: string
): Promise<boolean> {
  return sendQueueNotification(phone, {
    queueNumber,
    patientName,
    status: 'serving',
  });
}

/**
 * ส่งข้อความแจ้งเตือนเมื่อเสร็จสิ้น
 */
export async function sendQueueCompletedNotification(
  phone: string,
  queueNumber: string,
  patientName: string
): Promise<boolean> {
  return sendQueueNotification(phone, {
    queueNumber,
    patientName,
    status: 'completed',
  });
}

/**
 * ส่งข้อความแจ้งเตือนเมื่อยกเลิกคิว
 */
export async function sendQueueCancelledNotification(
  phone: string,
  queueNumber: string,
  patientName: string
): Promise<boolean> {
  return sendQueueNotification(phone, {
    queueNumber,
    patientName,
    status: 'cancelled',
  });
}

/**
 * ดึงรายชื่อ LINE Users ทั้งหมด
 */
export function getAllLineUsers(): LineUserProfile[] {
  if (typeof window === 'undefined') return [];
  
  const lineUsers = localStorage.getItem('clinic-q-line-users');
  if (!lineUsers) return [];
  
  try {
    return JSON.parse(lineUsers);
  } catch {
    return [];
  }
}

/**
 * ลบ LINE User
 */
export function removeLineUser(userId: string): void {
  if (typeof window === 'undefined') return;
  
  const lineUsers = localStorage.getItem('clinic-q-line-users');
  if (!lineUsers) return;
  
  try {
    const users: LineUserProfile[] = JSON.parse(lineUsers);
    const filtered = users.filter(u => u.userId !== userId);
    localStorage.setItem('clinic-q-line-users', JSON.stringify(filtered));
  } catch {}
}
