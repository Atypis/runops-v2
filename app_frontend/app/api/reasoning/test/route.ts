import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[API] Test reasoning endpoint called:', body);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test endpoint working',
      receivedData: body 
    });
  } catch (error) {
    console.error('[API] Test endpoint error:', error);
    return NextResponse.json(
      { error: 'Test endpoint failed' },
      { status: 500 }
    );
  }
}