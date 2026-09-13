/**
 * LINE message builders for queue notifications.
 *
 * Server-safe (no browser APIs) so both the client sender and the server-side
 * `/api/line/notify` route build the exact same message. The wording lives here
 * only — duplicating it in the route would let the two drift apart.
 */

export interface QueueMessageData {
  queueNumber: string
  patientName: string
  roomNumber?: number
  practitionerName?: string
  /** Queues still ahead of the patient (used by the 'ahead' message). */
  queuesAhead?: number
}

export type LineQueueMessageType = 'called' | 'serving' | 'completed' | 'cancelled' | 'ahead'

/** A LINE message payload (flex bubble or plain text). */
export type LineMessage = { type: 'flex'; altText: string; contents: unknown } | { type: 'text'; text: string }

function row(label: string, value: string) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', flex: 2 },
      { type: 'text', text: value, size: 'sm', weight: 'bold', flex: 3 },
    ],
  }
}

export function buildQueueMessage(type: LineQueueMessageType, data: QueueMessageData): LineMessage {
  switch (type) {
    case 'called':
      return {
        type: 'flex',
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
                  row('คิว', data.queueNumber),
                  ...(data.roomNumber ? [row('ห้อง', `ห้อง ${data.roomNumber}`)] : []),
                  ...(data.practitionerName ? [row('ผู้ทำหัตถการ', data.practitionerName)] : []),
                ],
                backgroundColor: '#F5F5F5',
                cornerRadius: 'md',
                paddingAll: '12px',
              },
              { type: 'text', text: 'กรุณาเข้าห้องตรวจภายใน 5 นาที', size: 'xs', color: '#999999', margin: 'md', align: 'center' },
            ],
          },
        },
      }

    case 'ahead':
      return {
        type: 'flex',
        altText: `⏰ อีก ${data.queuesAhead ?? 1} คิวจะถึงคิวของคุณ (${data.queueNumber})`,
        contents: {
          type: 'bubble',
          size: 'kilo',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: '⏰ ใกล้ถึงคิวของคุณแล้ว', weight: 'bold', size: 'lg' }],
            backgroundColor: '#F59E0B',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: `สวัสดีค่ะ คุณ${data.patientName}`, size: 'md', wrap: true },
              {
                type: 'text',
                text: `อีก ${data.queuesAhead ?? 1} คิวจะถึงคิวของคุณค่ะ`,
                size: 'md',
                weight: 'bold',
                margin: 'md',
                color: '#B45309',
              },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                contents: [row('คิวของคุณ', data.queueNumber)],
                backgroundColor: '#F5F5F5',
                cornerRadius: 'md',
                paddingAll: '12px',
              },
              { type: 'text', text: 'กรุณาเตรียมตัวและรอใกล้ห้องตรวจ', size: 'xs', color: '#999999', margin: 'md', align: 'center' },
            ],
          },
        },
      }

    case 'serving':
      return {
        type: 'flex',
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
      }

    case 'completed':
      return {
        type: 'flex',
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
      }

    case 'cancelled':
      return {
        type: 'flex',
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
      }
  }
}
