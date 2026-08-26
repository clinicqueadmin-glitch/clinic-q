import { NextRequest, NextResponse } from 'next/server';

/**
 * LINE Webhook API Endpoint
 * 
 * POST /api/line/webhook
 * 
 * ใช้รับ Webhook Events จาก LINE Official Account
 * - follow: เมื่อมีผู้ใช้ใหม่เพิ่มเพื่อน
 * - message: เมื่อผู้ใช้ส่งข้อความ
 * - postback: เมื่อกดปุ่มใน Rich Menu
 */

// LINE Webhook Event Types
interface LineWebhookEvent {
  type: 'follow' | 'unfollow' | 'message' | 'postback' | 'join' | 'leave';
  replyToken?: string;
  source: {
    userId?: string;
    type: 'user' | 'group' | 'room';
    groupId?: string;
  };
  message?: {
    id: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'location' | 'sticker';
    text?: string;
  };
  postback?: {
    data: string;
    params?: Record<string, string>;
  };
  timestamp: number;
}

// LINE Webhook Request Body
interface LineWebhookBody {
  events: LineWebhookEvent[];
  destination: string;
}

/**
 * GET - สำหรับ Webhook Verification
 * LINE จะส่ง GET request มาเพื่อตรวจสอบว่า URL ถูกต้อง
 */
export async function GET(request: NextRequest) {
  // LINE Webhook URL Verification
  return NextResponse.json({ message: 'LINE Webhook is active' }, { status: 200 });
}

/**
 * POST - รับ Webhook Events จาก LINE
 */
export async function POST(request: NextRequest) {
  try {
    const body: LineWebhookBody = await request.json();
    
    console.log('LINE Webhook received:', JSON.stringify(body, null, 2));
    
    // ตรวจสอบ signature (ควร verify ด้วย channel secret ใน production)
    // const signature = request.headers.get('x-line-signature');
    // if (!verifySignature(body, signature, channelSecret)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }
    
    // Process each event
    for (const event of body.events) {
      await processWebhookEvent(event);
    }
    
    return NextResponse.json({ message: 'OK' }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Process individual webhook event
 */
async function processWebhookEvent(event: LineWebhookEvent) {
  switch (event.type) {
    case 'follow':
      await handleFollowEvent(event);
      break;
    case 'message':
      await handleMessageEvent(event);
      break;
    case 'postback':
      await handlePostbackEvent(event);
      break;
    case 'unfollow':
      await handleUnfollowEvent(event);
      break;
    case 'join':
      await handleJoinEvent(event);
      break;
    case 'leave':
      await handleLeaveEvent(event);
      break;
    default:
      console.log('Unknown event type:', event.type);
  }
}

/**
 * จัดการ Follow Event - เมื่อมีผู้ใช้ใหม่เพิ่มเพื่อน
 */
async function handleFollowEvent(event: LineWebhookEvent) {
  if (!event.source.userId) return;
  
  console.log('New follower:', event.source.userId);
  
  // ในอนาคต: ดึงข้อมูล LINE User Profile จาก API
  // const profile = await getLineUserProfile(event.source.userId);
  
  // บันทึกข้อมูลลง database (เชื่อมกับเบอร์โทร)
  // await saveLineUser({
  //   userId: event.source.userId,
  //   clinicId: getClinicIdFromDestination(event.destination),
  // });
  
  // ส่งข้อความต้อนรับ
  // await sendWelcomeMessage(event.source.userId);
}

/**
 * จัดการ Message Event - เมื่อผู้ใช้ส่งข้อความ
 */
async function handleMessageEvent(event: LineWebhookEvent) {
  if (!event.source.userId || !event.message) return;
  
  const text = event.message.text?.trim().toLowerCase();
  
  console.log('Message received:', text, 'from:', event.source.userId);
  
  // จัดการข้อความตามคำสั่ง
  switch (text) {
    case 'เช็คคิว':
    case 'check':
    case 'status':
      // ส่งข้อความให้กรอกเบอร์โทร
      // await sendReplyMessage(event.replyToken, {
      //   type: 'text',
      //   text: 'กรุณากรอกเบอร์โทรศัพท์ของคุณเพื่อตรวจสอบสถานะคิว'
      // });
      break;
      
    case 'จองคิว':
    case 'book':
      // ส่งลิงก์สำหรับจองคิว
      // const bookingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/book`;
      // await sendReplyMessage(event.replyToken, {
      //   type: 'text',
      //   text: 'จองคิวได้ที่: ' + bookingUrl
      // });
      break;
      
    default:
      // ตรวจสอบว่าเป็นเบอร์โทรหรือไม่
      const phoneRegex = /^[0-9-]{10,12}$/;
      if (text && phoneRegex.test(text.replace(/-/g, ''))) {
        // ค้นหาคิวจากเบอร์โทร
        // const queue = await findQueueByPhone(text);
        // if (queue) {
        //   await sendQueueStatus(event.replyToken, queue);
        // } else {
        //   await sendReplyMessage(event.replyToken, {
        //     type: 'text',
        //     text: 'ไม่พบคิวสำหรับเบอร์โทรนี้ในวันนี้'
        //   });
        // }
      }
      break;
  }
}

/**
 * จัดการ Postback Event - เมื่อกดปุ่มใน Rich Menu
 */
async function handlePostbackEvent(event: LineWebhookEvent) {
  if (!event.postback) return;
  
  const data = event.postback.data;
  console.log('Postback received:', data);
  
  // จัดการ postback ตาม data
  // เช่น: action=check_queue, action=book_queue, etc.
}

/**
 * จัดการ Unfollow Event - เมื่อผู้ใช้บล็อกหรือลบเพื่อน
 */
async function handleUnfollowEvent(event: LineWebhookEvent) {
  if (!event.source.userId) return;
  
  console.log('User unfollowed:', event.source.userId);
  
  // ลบ LINE User ID ออกจาก database (หรือ mark as inactive)
  // await removeLineUser(event.source.userId);
}

/**
 * จัดการ Join Event - เมื่อบอทเข้าร่วมกลุ่ม
 */
async function handleJoinEvent(event: LineWebhookEvent) {
  console.log('Bot joined:', event.source);
  
  // ส่งข้อความแนะนำตัวในกลุ่ม
  // await sendGroupWelcomeMessage(event.replyToken);
}

/**
 * จัดการ Leave Event - เมื่อบอทออกจากกลุ่ม
 */
async function handleLeaveEvent(event: LineWebhookEvent) {
  console.log('Bot left:', event.source);
}

/**
 * Verify Webhook Signature (ควรใช้ใน Production)
 */
function verifySignature(
  body: LineWebhookBody,
  signature: string | null,
  channelSecret: string
): boolean {
  if (!signature) return false;
  
  // ใช้ crypto module ในการ verify
  // const crypto = require('crypto');
  // const hash = crypto.createHmac('sha256', channelSecret)
  //   .update(JSON.stringify(body))
  //   .digest('base64');
  // return hash === signature;
  
  return true; // Placeholder - implement real verification in production
}
