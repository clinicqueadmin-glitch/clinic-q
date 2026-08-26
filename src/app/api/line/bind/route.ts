import { NextRequest, NextResponse } from 'next/server';

/**
 * LINE Bind API Endpoint
 * 
 * POST /api/line/bind
 * 
 * ใช้เก็บ LINE User ID กับเบอร์โทรศัพท์ของคนไข้
 */

interface BindRequest {
  userId: string;
  phoneNumber: string;
  clinicId: string;
  displayName?: string;
}

interface LineUserProfile {
  userId: string;
  phoneNumber: string;
  clinicId: string;
  displayName: string;
  createdAt: string;
}

// In-memory storage (in production, use database)
const lineUsers: Map<string, LineUserProfile> = new Map();

/**
 * POST - เก็บ LINE User ID กับเบอร์โทรศัพท์
 */
export async function POST(request: NextRequest) {
  try {
    const body: BindRequest = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.phoneNumber) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน (userId, phoneNumber)' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^[0-9-]{10,12}$/;
    if (!phoneRegex.test(body.phoneNumber.replace(/-/g, ''))) {
      return NextResponse.json(
        { error: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Validate LINE User ID format
    if (!body.userId.startsWith('U') || body.userId.length < 20) {
      return NextResponse.json(
        { error: 'LINE User ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Create or update user profile
    const profile: LineUserProfile = {
      userId: body.userId,
      phoneNumber: body.phoneNumber,
      clinicId: body.clinicId || 'default',
      displayName: body.displayName || `LINE User ${body.userId.slice(-6)}`,
      createdAt: new Date().toISOString(),
    };

    // Store in memory (in production, save to database)
    lineUsers.set(body.userId, profile);

    // Also store by phone number for lookup
    const phoneKey = `phone:${body.phoneNumber.replace(/-/g, '')}`;
    lineUsers.set(phoneKey, profile);

    console.log('LINE User bound:', profile);

    return NextResponse.json({
      success: true,
      message: 'เชื่อมต่อบัญชี LINE สำเร็จ',
      profile: {
        userId: body.userId,
        phoneNumber: body.phoneNumber,
        displayName: profile.displayName,
      },
    });
  } catch (error) {
    console.error('LINE bind error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' },
      { status: 500 }
    );
  }
}

/**
 * GET - ดึงข้อมูล LINE User จากเบอร์โทรศัพท์
 */
export async function GET(request: NextRequest) {
  const phoneNumber = request.nextUrl.searchParams.get('phone');
  const userId = request.nextUrl.searchParams.get('userId');

  if (phoneNumber) {
    const phoneKey = `phone:${phoneNumber.replace(/-/g, '')}`;
    const profile = lineUsers.get(phoneKey);
    
    if (profile) {
      return NextResponse.json({
        success: true,
        profile,
      });
    }
    
    return NextResponse.json(
      { success: false, message: 'ไม่พบข้อมูล LINE User' },
      { status: 404 }
    );
  }

  if (userId) {
    const profile = lineUsers.get(userId);
    
    if (profile) {
      return NextResponse.json({
        success: true,
        profile,
      });
    }
    
    return NextResponse.json(
      { success: false, message: 'ไม่พบข้อมูล LINE User' },
      { status: 404 }
    );
  }

  // Return all users (for admin)
  const allUsers = Array.from(lineUsers.values()).filter(
    (value, index, self) => index === self.findIndex((t) => t.userId === value.userId)
  );

  return NextResponse.json({
    success: true,
    users: allUsers,
    total: allUsers.length,
  });
}

/**
 * DELETE - ลบ LINE User
 */
export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json(
      { error: 'กรุณาระบุ userId' },
      { status: 400 }
    );
  }

  const profile = lineUsers.get(userId);
  if (!profile) {
    return NextResponse.json(
      { success: false, message: 'ไม่พบข้อมูล LINE User' },
      { status: 404 }
    );
  }

  // Delete from both maps
  lineUsers.delete(userId);
  const phoneKey = `phone:${profile.phoneNumber.replace(/-/g, '')}`;
  lineUsers.delete(phoneKey);

  console.log('LINE User deleted:', userId);

  return NextResponse.json({
    success: true,
    message: 'ลบ LINE User สำเร็จ',
  });
}
