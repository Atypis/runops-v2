import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/direct-sop/[sopId]
 * Retrieves a mock SOP document from the public folder
 * No authentication required - for development/testing only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sopId: string } }
) {
  try {
    const { sopId } = params;
    
    if (!sopId) {
      return NextResponse.json(
        { error: 'SOP ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching direct SOP data for sopId: ${sopId}`);

    // Determine file path - look for exact match or with .json extension
    let filePath = path.join(process.cwd(), 'public', `${sopId}`);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', `${sopId}.json`);
    }

    // If still not found, try with "mocksop-" prefix
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', `mocksop-${sopId}.json`);
    }

    // If still not found, try with "mocksop" prefix
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', `mocksop${sopId}.json`);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return NextResponse.json(
        { error: 'SOP file not found' },
        { status: 404 }
      );
    }

    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let sopData;
    
    try {
      sopData = JSON.parse(fileContent);
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return NextResponse.json(
        { error: 'Invalid SOP data format' },
        { status: 500 }
      );
    }

    // Return a response with the SOP data wrapped in the expected format
    return NextResponse.json({
      data: sopData
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 