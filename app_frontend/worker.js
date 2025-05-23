const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Configuration
const POLL_INTERVAL = 10000; // 10 seconds
const TEMP_DIR = path.join(os.tmpdir(), 'runops-worker');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';

// Load the SOP parser prompt from file
const PROMPT_PATH = path.join(__dirname, 'prompts', 'flat_sop_parser_v0.9 copy.md');
let SOP_PARSING_PROMPT;
try {
  SOP_PARSING_PROMPT = fs.readFileSync(PROMPT_PATH, 'utf8');
  console.log(`Loaded SOP parsing prompt (${SOP_PARSING_PROMPT.length} chars) - SIMPLIFIED VERSION v0.9.0`);
} catch (error) {
  console.error(`ERROR: Could not load SOP parsing prompt from ${PROMPT_PATH}:`, error);
  process.exit(1);
}

// Load the transcription prompt from file
const TRANSCRIPTION_PROMPT_PATH = path.join(__dirname, 'prompts', 'transcription_prompt_v1.md');
let TRANSCRIPTION_PROMPT;
try {
  TRANSCRIPTION_PROMPT = fs.readFileSync(TRANSCRIPTION_PROMPT_PATH, 'utf8');
  console.log(`Loaded transcription prompt (${TRANSCRIPTION_PROMPT.length} chars)`);
} catch (error) {
  console.error(`ERROR: Could not load transcription prompt from ${TRANSCRIPTION_PROMPT_PATH}:`, error);
  process.exit(1);
}

// Initialize Gemini API client
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Ensure the necessary storage folders exist
async function ensureStorageFolders() {
  try {
    console.log('Checking and creating storage folders if needed...');
    
    const folders = ['raw', 'slim', 'sops', 'transcripts'];
    
    for (const folder of folders) {
      // Check if folder exists by trying to list files
      const { data, error } = await supabase.storage
        .from('videos')
        .list(folder, { limit: 1 });
      
      if (error && error.statusCode === 404) {
        // Folder doesn't exist, create it with an empty placeholder file
        console.log(`Creating ${folder} folder in storage...`);
        const placeholderContent = Buffer.from('This is a placeholder file to ensure the folder exists.');
        
        await supabase.storage
          .from('videos')
          .upload(`${folder}/.placeholder`, placeholderContent, {
            contentType: 'text/plain',
            upsert: true
          });
          
        console.log(`Created ${folder} folder in storage`);
      } else {
        console.log(`${folder} folder already exists in storage`);
      }
    }
  } catch (error) {
    console.error('Error ensuring storage folders:', error);
  }
}

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
      await processJob(job);
    }
  } catch (error) {
    console.error('Error in processJobs:', error);
  } finally {
    // Schedule next check
    setTimeout(processJobs, POLL_INTERVAL);
  }
}

// Process a single job
async function processJob(job) {
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
    await updateJobStatus(jobId, 'error', error.message);
    cleanupTempFiles(jobId);
  }
}

// Download the raw video from storage
async function downloadVideo(jobId) {
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
async function processVideo(inputPath, jobId) {
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
      .on('error', (err) => {
        console.error('Error during video processing:', err);
        resolve(null);
      })
      .run();
  });
}

// Upload the processed video to storage
async function uploadSlimVideo(filePath, jobId) {
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
async function extractSopFromVideo(videoPath, jobId) {
  console.log(`Extracting SOP from video ${videoPath}...`);
  
  // Step 1: Transcribe the video
  console.log('Step 1: Transcribing video...');
  const transcript = await transcribeVideo(videoPath);
  if (!transcript) {
    throw new Error('Failed to transcribe video');
  }
  
  // Save transcript for debugging
  const transcriptPath = path.join(TEMP_DIR, `${jobId}_transcript.json`);
  fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));
  console.log(`Saved transcript to ${transcriptPath}`);
  
  // Save transcript to database
  await saveTranscriptToDatabase(jobId, transcript);
  
  // Step 2: Generate SOP from transcript
  console.log('Step 2: Generating SOP from transcript...');
  const sopData = await generateSopFromTranscript(transcript);
  if (!sopData) {
    throw new Error('Failed to generate SOP from transcript');
  }
  
  // Upload the JSON to storage as well for reference
  const jsonPath = path.join(TEMP_DIR, `${jobId}_sop.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(sopData, null, 2));
  
  await uploadSopJson(jsonPath, jobId);
  
  // Also upload the transcript
  await uploadTranscriptJson(transcriptPath, jobId);
  
  return sopData;
}

// Step 1: Transcribe video using Gemini API
async function transcribeVideo(videoPath) {
  // Read video file as base64
  const fileBuffer = fs.readFileSync(videoPath);
  const base64Video = fileBuffer.toString('base64');
  
  // Get Gemini model - using 2.5 Flash Preview which has video capabilities
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
  
  // Maximum number of retries
  const MAX_RETRIES = 3;
  let attempt = 0;
  let transcriptData = null;
  
  while (attempt < MAX_RETRIES && !transcriptData) {
    attempt++;
    console.log(`Transcription attempt ${attempt}...`);
    
    try {
      // Generate content with the model
      const result = await model.generateContent([
        TRANSCRIPTION_PROMPT,
        {
          inlineData: {
            mimeType: "video/mp4",
            data: base64Video
          }
        }
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      // Log the first 500 chars of the response for debugging
      console.log(`Raw transcription (first 500 chars): ${text.substring(0, 500)}...`);
      
      // Clean up the response text to handle markdown code blocks or any other formatting
      let cleanedText = text;
      
      // Remove markdown code blocks if present
      if (text.includes('```json') || text.includes('```')) {
        cleanedText = text.replace(/```json\n|\n```|```/g, '');
      }
      
      // Trim any leading/trailing whitespace
      cleanedText = cleanedText.trim();
      
      try {
        // For a transcription, we expect an array
        transcriptData = JSON.parse(cleanedText);
        console.log(`Successfully extracted transcript data with ${transcriptData.length} entries`);
      } catch (parseError) {
        console.error('Invalid JSON transcript from Gemini API:', parseError);
        console.error('Clean text (first 500 chars):', cleanedText.substring(0, 500) + '...');
      }
    } catch (error) {
      console.error(`Error during Gemini API transcription (attempt ${attempt}):`, error);
    }
    
    // If not successful and not the last attempt, wait before retrying
    if (!transcriptData && attempt < MAX_RETRIES) {
      console.log(`Waiting 5 seconds before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (!transcriptData) {
    console.error(`Failed to transcribe video after ${MAX_RETRIES} attempts`);
    return null;
  }
  
  return transcriptData;
}

// Step 2: Generate SOP from transcript
async function generateSopFromTranscript(transcript) {
  // Get Gemini model
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
  
  // Maximum number of retries
  const MAX_RETRIES = 3;
  let attempt = 0;
  let sopData = null;
  
  // Create a prompt that includes both the SOP parser instructions and the transcript
  const transcriptJson = JSON.stringify(transcript);
  const combinedPrompt = `${SOP_PARSING_PROMPT}\n\nHere is the transcript of the video:\n${transcriptJson}`;
  
  while (attempt < MAX_RETRIES && !sopData) {
    attempt++;
    console.log(`SOP generation attempt ${attempt}...`);
    
    try {
      // Generate content with the model
      const result = await model.generateContent(combinedPrompt);
      
      const response = await result.response;
      const text = response.text();
      
      // Log the first 500 chars of the response for debugging
      console.log(`Raw SOP response (first 500 chars): ${text.substring(0, 500)}...`);
      
      // Clean up the response text to handle markdown code blocks or any other formatting
      let cleanedText = text;
      
      // Remove markdown code blocks if present
      if (text.includes('```json') || text.includes('```')) {
        cleanedText = text.replace(/```json\n|\n```|```/g, '');
      }
      
      // Trim any leading/trailing whitespace
      cleanedText = cleanedText.trim();
      
      // Look for the first '{' and the last '}' to extract just the JSON object
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
      }
      
      // Validate that the response is valid JSON
      try {
        sopData = JSON.parse(cleanedText);
        console.log(`Successfully extracted SOP data`);
        console.log(`SOP meta: ${JSON.stringify(sopData.meta || {})}`);
        console.log(`SOP nodes: ${(sopData.public?.nodes || []).length} nodes`);
      } catch (parseError) {
        console.error('Invalid JSON response from Gemini API:', parseError);
        console.error('Clean text (first 500 chars):', cleanedText.substring(0, 500) + '...');
        
        // Try fallback JSON extraction if standard parsing failed
        try {
          // Look for patterns that might indicate JSON embedded in other text
          const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
          const jsonMatches = cleanedText.match(jsonRegex);
          
          if (jsonMatches && jsonMatches.length > 0) {
            // Try the largest JSON match (likely the complete structure)
            const largestMatch = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
            sopData = JSON.parse(largestMatch);
            console.log('Successfully extracted SOP data using fallback method');
            console.log(`SOP meta: ${JSON.stringify(sopData.meta || {})}`);
            console.log(`SOP nodes: ${(sopData.public?.nodes || []).length} nodes`);
          }
        } catch (fallbackError) {
          console.error('Fallback JSON extraction also failed:', fallbackError);
        }
      }
    } catch (error) {
      console.error(`Error during Gemini API SOP generation (attempt ${attempt}):`, error);
    }
    
    // If not successful and not the last attempt, wait before retrying
    if (!sopData && attempt < MAX_RETRIES) {
      console.log(`Waiting 5 seconds before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (!sopData) {
    console.error(`Failed to generate SOP after ${MAX_RETRIES} attempts`);
    return null;
  }
  
  return sopData;
}

// Upload the transcript JSON to storage
async function uploadTranscriptJson(filePath, jobId) {
  const storagePath = `transcripts/${jobId}.json`;
  
  console.log(`Uploading transcript JSON to ${storagePath}...`);

  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    const { error } = await supabase.storage
      .from('videos') // Using the same bucket
      .upload(storagePath, fileBuffer, {
        contentType: 'application/json',
        upsert: true
      });

    if (error) {
      console.error(`Error uploading transcript JSON ${storagePath}:`, error);
      return false;
    }

    console.log(`Transcript JSON uploaded to ${storagePath}`);
    return true;
  } catch (error) {
    console.error('Error in uploadTranscriptJson:', error);
    return false;
  }
}

// Upload the SOP JSON to storage
async function uploadSopJson(filePath, jobId) {
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
async function saveSopToDatabase(jobId, sopData) {
  console.log(`Saving SOP data to database for job ${jobId}...`);
  
  try {
    // Get the user_id from the job if available
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('metadata')
      .eq('job_id', jobId)
      .single();
    
    if (jobError) {
      console.error(`Error getting job metadata:`, jobError);
    }
    
    const user_id = jobData?.metadata?.user_id || null;
    console.log(`User ID for job ${jobId}: ${user_id || 'Not available'}`);
    
    // Insert the SOP data into the sops table
    const { data, error } = await supabase
      .from('sops')
      .insert([
        {
          job_id: jobId,
          user_id: user_id,
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

// Save transcript to database
async function saveTranscriptToDatabase(jobId, transcript) {
  console.log(`Saving transcript to database for job ${jobId}...`);
  
  try {
    // Insert the transcript data into the transcripts table
    const { data, error } = await supabase
      .from('transcripts')
      .insert([
        {
          job_id: jobId,
          transcript: transcript,
          created_at: new Date().toISOString()
        }
      ]);
      
    if (error) {
      console.error(`Error saving transcript to database:`, error);
      return false;
    }
    
    console.log(`Transcript saved to database successfully`);
    return true;
  } catch (error) {
    console.error('Error in saveTranscriptToDatabase:', error);
    return false;
  }
}

// Update job status in the database
async function updateJobStatus(jobId, status, errorMessage) {
  try {
    const updates = {
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
function cleanupTempFiles(jobId) {
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
// First ensure storage folders exist, then start processing jobs
ensureStorageFolders().then(() => {
  console.log('Storage structure verified, starting job processing...');
  processJobs();
}).catch(error => {
  console.error('Error during worker startup:', error);
  console.log('Starting job processing anyway...');
  processJobs();
}); 