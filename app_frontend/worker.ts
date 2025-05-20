import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic as string);

// Configuration
const POLL_INTERVAL = 10000; // 10 seconds
const TEMP_DIR = path.join(os.tmpdir(), 'runops-worker');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';

// Initialize Gemini API client
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// SOP parsing prompt
const SOP_PARSING_PROMPT = `You are an expert video analysis assistant. Your task is to meticulously transcribe a screen recording with accompanying audio narration, focusing on capturing raw, observable data with extreme detail and precision. Output a JSON array where each object represents a distinct, timestamped visual event or a segment of audio narration.
Primary Goal: Create a high-fidelity, chronological log of all visual changes, user interactions, and spoken words. Avoid interpretation, summarization, or inference beyond direct observation.
For each VISUAL event, provide:
1. timestamp_start_visual: The start time (HH:MM:SS.mmm format for milliseconds if possible, otherwise HH:MM:SS) of the visual event or observation.
2. timestamp_end_visual: (Optional) The end time if the visual state or action has a clear duration.
3. application_in_focus: The name of the primary application or window in focus (e.g., "Google Chrome - Gmail", "Airtable Desktop App").
4. action_type_observed: The observed user action. Choose from: CLICK, TYPE, PASTE, KEYPRESS (specify key if observable, e.g., KEYPRESS_ENTER), SCROLL (specify direction if clear), MOUSE_MOVE_TO_REGION (describe region), DRAG_START, DRAG_END, SELECT_TEXT, HIGHLIGHT_TEXT, NAVIGATE_URL, SWITCH_TAB, OPEN_APPLICATION, WINDOW_RESIZE, MODAL_OPEN, MODAL_CLOSE, VISUAL_FOCUS_SHIFT (describe new area of focus). If no direct user action but the screen changes significantly (e.g., page load, new elements appear), use SCREEN_UPDATE.
5. target_element_details: (If action_type_observed involves a specific element)
    * element_type_guess: Best guess of the UI element type based on appearance/behavior (e.g., BUTTON, INPUT_FIELD, LINK, TAB, ICON, TEXT_AREA, CHECKBOX, DROPDOWN_MENU, SCROLL_BAR).
    * element_visible_text: Any visible text on or immediately labeling the element (e.g., button label, link text, text within an input field before typing if action_type_observed is TYPE).
    * element_bounding_box_pixels: (Optional, if detectable) Approximate pixel coordinates [x_top_left, y_top_left, width, height] of the element interacted with or focused on.
    * element_attributes_observed: (Optional, if visually discernible or from dev tools if shown) Any visually apparent attributes like 'disabled', 'checked', 'selected'.
6. data_input_observed: (If action_type_observed involves data entry)
    * typed_characters: Exact sequence of characters typed.
    * pasted_text_observed: Exact text observed appearing after a paste action.
    * selected_value_observed: The visible text of an option selected from a dropdown or list.
7. screen_region_description_pre_action: Brief description of the primary screen region of focus before the action/update.
8. screen_region_description_post_action: Detailed description of the primary screen region of focus after the action/update, noting all visible changes (e.g., "Text '...' appeared in field '...'", "Modal '...' opened", "Page navigated to '...'", "Element '...' highlighted").
For each AUDIO segment, provide:
1. timestamp_start_audio: The start time (HH:MM:SS.mmm format) of the spoken segment.
2. timestamp_end_audio: The end time (HH:MM:SS.mmm format) of the spoken segment.
3. verbatim_transcript_segment: A precise, word-for-word transcript of what the user said during this specific audio segment. Include all filler words, ums, ahs, and self-corrections.
Important Guidelines:
* Separate Streams for Visual and Audio: Output visual events and audio segments as separate objects in the main JSON array. They will be correlated later using their timestamps.
* Strict Chronological Order: All objects (visual or audio) in the array must be strictly ordered by their timestamp_start_....
* Extreme Granularity for Visuals: Break down complex interactions into the smallest observable atomic visual changes or user inputs. For example, each keystroke could ideally be an event if distinct visual feedback occurs, or group rapid typing into one "TYPE" event with the full typed_characters. Err on the side of more events if unsure.
* Describe, Don't Interpret Visuals: Focus on what is visually present and changing. Avoid interpreting why it changed unless it's a direct result of a user action.
* Verbatim Audio: The audio transcript must be as literal as possible. Do not summarize or paraphrase.
* No Inferred Intent or Goals: Do NOT include fields for inferred_user_intent_or_goal, key_phrases_or_entities_mentioned (unless strictly part of the verbatim transcript itself), or high-level overall_screen_context that requires summarization.
* Completeness: Strive to capture every single discernible visual UI change, user interaction, and every spoken word.
* Output ONLY the JSON array. Do not include any other text or markdown formatting.`;

// Job type definition
interface Job {
  id: number;
  job_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error?: string;
  metadata?: any;
}

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Main worker function
async function processJobs() {
  try {
    console.log('Checking for queued jobs...');

    // Query for queued jobs
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Error fetching jobs:', error);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log('No queued jobs found');
      return;
    }

    // Process each job
    for (const job of jobs) {
      await processJob(job as Job);
    }
  } catch (error) {
    console.error('Error in processJobs:', error);
  } finally {
    // Schedule next check
    setTimeout(processJobs, POLL_INTERVAL);
  }
}

// Process a single job
async function processJob(job: Job) {
  const jobId = job.job_id;
  console.log(`Processing job ${jobId}...`);

  try {
    // Update job status to processing
    await updateJobStatus(jobId, 'processing');

    // Download the raw video
    const rawVideoPath = await downloadVideo(jobId);
    if (!rawVideoPath) {
      throw new Error('Failed to download video');
    }

    // Process the video with ffmpeg
    const slimVideoPath = await processVideo(rawVideoPath, jobId);
    if (!slimVideoPath) {
      throw new Error('Failed to process video');
    }

    // Upload the processed video
    await uploadSlimVideo(slimVideoPath, jobId);

    // Process the video with Gemini API to extract SOP
    const sopData = await extractSopFromVideo(slimVideoPath, jobId);
    if (!sopData) {
      throw new Error('Failed to extract SOP from video');
    }

    // Save the SOP to the database
    await saveSopToDatabase(jobId, sopData);

    // Mark job as completed
    await updateJobStatus(jobId, 'completed');
    console.log(`Job ${jobId} completed successfully`);
    
    // Clean up temporary files
    cleanupTempFiles(jobId);
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'error', (error as Error).message);
    cleanupTempFiles(jobId);
  }
}

// Download the raw video from storage
async function downloadVideo(jobId: string): Promise<string | null> {
  const filePath = `raw/${jobId}.mp4`;
  const localPath = path.join(TEMP_DIR, `${jobId}_raw.mp4`);

  console.log(`Downloading video from ${filePath} to ${localPath}...`);

  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .download(filePath);

    if (error) {
      console.error(`Error downloading video ${filePath}:`, error);
      return null;
    }

    fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
    console.log(`Video downloaded to ${localPath}`);
    return localPath;
  } catch (error) {
    console.error(`Error in downloadVideo:`, error);
    return null;
  }
}

// Process the video with ffmpeg
async function processVideo(inputPath: string, jobId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const outputPath = path.join(TEMP_DIR, `${jobId}_slim.mp4`);
    
    console.log(`Processing video with ffmpeg: ${inputPath} -> ${outputPath}`);
    console.log('Using settings: fps=1, scale=-2:720, crf=32');

    ffmpeg(inputPath)
      .outputOptions([
        '-vf fps=1', // 1 frame per second
        '-vf scale=-2:720', // 720p height, preserving aspect ratio
        '-crf 32', // Compression factor (higher = smaller file)
      ])
      .output(outputPath)
      .on('end', () => {
        console.log(`Video processing complete: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err: Error) => {
        console.error('Error during video processing:', err);
        resolve(null);
      })
      .run();
  });
}

// Upload the processed video to storage
async function uploadSlimVideo(filePath: string, jobId: string): Promise<boolean> {
  const storagePath = `slim/${jobId}.mp4`;
  
  console.log(`Uploading slim video to ${storagePath}...`);

  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    const { error } = await supabase.storage
      .from('videos')
      .upload(storagePath, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (error) {
      console.error(`Error uploading slim video ${storagePath}:`, error);
      return false;
    }

    console.log(`Slim video uploaded to ${storagePath}`);
    return true;
  } catch (error) {
    console.error('Error in uploadSlimVideo:', error);
    return false;
  }
}

// Process the video with Gemini API to extract SOP
async function extractSopFromVideo(videoPath: string, jobId: string): Promise<any> {
  console.log(`Extracting SOP from video ${videoPath}...`);
  
  // Read video file as base64
  const fileBuffer = fs.readFileSync(videoPath);
  const base64Video = fileBuffer.toString('base64');
  
  // Get Gemini model - using 2.5 Flash Preview which has video capabilities
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
  
  // Prepare content with the video
  const prompt = SOP_PARSING_PROMPT;
  
  // Maximum number of retries
  const MAX_RETRIES = 3;
  let attempt = 0;
  let sopData = null;
  
  while (attempt < MAX_RETRIES && !sopData) {
    attempt++;
    console.log(`Attempt ${attempt} to extract SOP...`);
    
    try {
      // Generate content with the model
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "video/mp4",
            data: base64Video
          }
        }
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      // Validate that the response is valid JSON
      try {
        sopData = JSON.parse(text);
        console.log(`Successfully extracted SOP data (${sopData.length} events/segments)`);
      } catch (parseError) {
        console.error('Invalid JSON response from Gemini API:', parseError);
        console.error('Raw response:', text.substring(0, 500) + '...');
      }
    } catch (error) {
      console.error(`Error during Gemini API call (attempt ${attempt}):`, error);
    }
    
    // If not successful and not the last attempt, wait before retrying
    if (!sopData && attempt < MAX_RETRIES) {
      console.log(`Waiting 5 seconds before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (!sopData) {
    console.error(`Failed to extract SOP after ${MAX_RETRIES} attempts`);
    return null;
  }
  
  // Upload the JSON to storage as well for reference
  const jsonPath = path.join(TEMP_DIR, `${jobId}_sop.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(sopData, null, 2));
  
  await uploadSopJson(jsonPath, jobId);
  
  return sopData;
}

// Upload the SOP JSON to storage
async function uploadSopJson(filePath: string, jobId: string): Promise<boolean> {
  const storagePath = `sops/${jobId}.json`;
  
  console.log(`Uploading SOP JSON to ${storagePath}...`);

  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    const { error } = await supabase.storage
      .from('videos') // Using the same bucket
      .upload(storagePath, fileBuffer, {
        contentType: 'application/json',
        upsert: true
      });

    if (error) {
      console.error(`Error uploading SOP JSON ${storagePath}:`, error);
      return false;
    }

    console.log(`SOP JSON uploaded to ${storagePath}`);
    return true;
  } catch (error) {
    console.error('Error in uploadSopJson:', error);
    return false;
  }
}

// Save SOP data to database
async function saveSopToDatabase(jobId: string, sopData: any): Promise<boolean> {
  console.log(`Saving SOP data to database for job ${jobId}...`);
  
  try {
    // Insert the SOP data into the sops table
    const { data, error } = await supabase
      .from('sops')
      .insert([
        {
          job_id: jobId,
          data: sopData,
          created_at: new Date().toISOString()
        }
      ]);
      
    if (error) {
      console.error(`Error saving SOP data to database:`, error);
      return false;
    }
    
    console.log(`SOP data saved to database successfully`);
    return true;
  } catch (error) {
    console.error('Error in saveSopToDatabase:', error);
    return false;
  }
}

// Update job status in the database
async function updateJobStatus(jobId: string, status: string, errorMessage?: string): Promise<void> {
  try {
    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Add additional fields based on status
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    
    if (status === 'error' && errorMessage) {
      updates.error = errorMessage;
    }

    const { error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('job_id', jobId);

    if (error) {
      console.error(`Error updating job status for ${jobId}:`, error);
    } else {
      console.log(`Job ${jobId} status updated to ${status}`);
    }
  } catch (error) {
    console.error('Error in updateJobStatus:', error);
  }
}

// Clean up temporary files
function cleanupTempFiles(jobId: string): void {
  try {
    const rawPath = path.join(TEMP_DIR, `${jobId}_raw.mp4`);
    const slimPath = path.join(TEMP_DIR, `${jobId}_slim.mp4`);
    const sopPath = path.join(TEMP_DIR, `${jobId}_sop.json`);
    
    if (fs.existsSync(rawPath)) {
      fs.unlinkSync(rawPath);
    }
    
    if (fs.existsSync(slimPath)) {
      fs.unlinkSync(slimPath);
    }
    
    if (fs.existsSync(sopPath)) {
      fs.unlinkSync(sopPath);
    }
    
    console.log(`Cleaned up temporary files for job ${jobId}`);
  } catch (error) {
    console.error(`Error cleaning up temp files for ${jobId}:`, error);
  }
}

// Start the worker
console.log('Starting Runops video processing worker...');
processJobs(); 