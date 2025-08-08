import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { AEFDocument, DEFAULT_AEF_CONFIG, AEFTransformResult } from '@/lib/types/aef';
import { SOPDocument } from '@/lib/types/sop';
import { CheckpointConfig, CheckpointType, CheckpointCondition, CheckpointAction } from '@/lib/types/checkpoint';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Load the new two-step prompts
const ATOMIC_PROMPT_PATH = path.join(process.cwd(), 'prompts', 'atomic_workflow_parser_v1.0.md');
const TECHNICAL_PROMPT_PATH = path.join(process.cwd(), 'prompts', 'aef_technical_translator_v1.0.md');

let ATOMIC_WORKFLOW_PROMPT: string;
let TECHNICAL_TRANSLATOR_PROMPT: string;

try {
  ATOMIC_WORKFLOW_PROMPT = fs.readFileSync(ATOMIC_PROMPT_PATH, 'utf8');
  console.log(`✅ Loaded Atomic Workflow Parser prompt (${ATOMIC_WORKFLOW_PROMPT.length} chars)`);
} catch (error) {
  console.error(`❌ Could not load Atomic Workflow Parser prompt from ${ATOMIC_PROMPT_PATH}:`, error);
  ATOMIC_WORKFLOW_PROMPT = `You are an atomic workflow parser. Please create a detailed, atomic SOP from the provided transcript.`;
}

try {
  TECHNICAL_TRANSLATOR_PROMPT = fs.readFileSync(TECHNICAL_PROMPT_PATH, 'utf8');
  console.log(`✅ Loaded Technical Translator prompt (${TECHNICAL_TRANSLATOR_PROMPT.length} chars)`);
} catch (error) {
  console.error(`❌ Could not load Technical Translator prompt from ${TECHNICAL_PROMPT_PATH}:`, error);
  TECHNICAL_TRANSLATOR_PROMPT = `You are a technical translator. Please enhance the provided SOP with browser automation instructions.`;
}

// Initialize Gemini AI client
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

/**
 * POST /api/aef/transform
 * Two-step transformation: SOP → Atomic SOP → Executable AEF
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sopId, config, useAtomicParser } = body;

    if (!sopId) {
      return NextResponse.json(
        { error: 'sopId is required' },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting ${useAtomicParser ? 'Two-Step Atomic' : 'Legacy'} AEF transformation for SOP ${sopId}`);

    // Fetch the original SOP document
    const { data: sopRecord, error: fetchError } = await supabase
      .from('sops')
      .select('*')
      .eq('job_id', sopId)
      .single();

    if (fetchError) {
      console.error('Error fetching SOP:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'SOP not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch SOP' },
        { status: 500 }
      );
    }

    const originalSop: SOPDocument = sopRecord.data;
    console.log(`📋 Original SOP loaded: ${originalSop.meta?.title || 'Untitled'}`);
    
    let enhancedSop: SOPDocument;
    let atomicEnhanced = false;
    let technicalTranslated = false;

    if (useAtomicParser) {
      console.log(`🔬 Starting two-step atomic enhancement process...`);
      
      try {
        // Step 1: Convert existing SOP to atomic SOP (if not already atomic)
        const atomicSop = await generateAtomicWorkflow(originalSop);
        atomicEnhanced = true;
        console.log(`✅ Step 1: Atomic workflow generated successfully`);
        
        // Step 2: Translate atomic SOP to executable instructions
        enhancedSop = await translateToExecutableInstructions(atomicSop);
        technicalTranslated = true;
        console.log(`✅ Step 2: Technical translation completed successfully`);
        
      } catch (error) {
        console.error('❌ Two-step atomic enhancement failed:', error);
        console.log('🔄 Falling back to legacy single-step enhancement');
        enhancedSop = await generateLegacyBrowserAutomation(originalSop);
      }
    } else {
      console.log(`🤖 Using legacy single-step enhancement...`);
      enhancedSop = await generateLegacyBrowserAutomation(originalSop);
    }
    
    // Generate checkpoints for all automatable steps (using enhanced SOP)
    const checkpoints = generateDefaultCheckpoints(enhancedSop);
    
    // Create AEF configuration
    const aefConfig = {
      ...DEFAULT_AEF_CONFIG,
      checkpoints,
      estimatedDuration: estimateExecutionDuration(enhancedSop),
      ...config // Override with any provided config
    };

    // Create AEF document with enhanced SOP
    const aefDocument: AEFDocument = {
      ...enhancedSop, // Use AI-enhanced version instead of original
      aef: {
        config: aefConfig,
        transformedAt: new Date(),
        transformedBy: user.id,
        version: useAtomicParser ? '2.0.0' : '1.0.0',
        automationEnhanced: enhancedSop !== originalSop,
        atomicEnhanced,
        technicalTranslated
      }
    };

    // Update the SOP record with AEF configuration
    const { error: updateError } = await supabase
      .from('sops')
      .update({ 
        data: aefDocument,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', sopId);

    if (updateError) {
      console.error('Error updating SOP with AEF config:', updateError);
      return NextResponse.json(
        { error: 'Failed to save AEF configuration' },
        { status: 500 }
      );
    }

    const result: AEFTransformResult = {
      success: true,
      aefDocument,
      estimatedStepCount: checkpoints.length,
      estimatedDuration: aefConfig.estimatedDuration,
      automationInstructionsGenerated: enhancedSop !== originalSop,
      enhancementMethod: useAtomicParser ? 'two-step-atomic' : 'legacy-single-step'
    };

    console.log(`🎉 AEF transformation completed for SOP ${sopId} using ${result.enhancementMethod}`);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in AEF transform:', error);
    return NextResponse.json(
      { error: 'Failed to transform SOP to AEF' },
      { status: 500 }
    );
  }
}

/**
 * 🆕 NEW: Step 1 - Generate atomic, UI-aware workflow from existing SOP
 */
async function generateAtomicWorkflow(sop: SOPDocument): Promise<SOPDocument> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
  
  // Create prompt to enhance existing SOP with atomic granularity
  const sopJson = JSON.stringify(sop, null, 2);
  const combinedPrompt = `${ATOMIC_WORKFLOW_PROMPT}

IMPORTANT: The provided SOP below already has good structure but needs to be made more atomic and UI-aware. Break down high-level steps into granular UI interactions while preserving the overall workflow logic.

Existing SOP to make atomic:

${sopJson}`;
  
  return await executeAIGeneration(model, combinedPrompt, 'Atomic Workflow Generation');
}

/**
 * 🆕 NEW: Step 2 - Translate atomic workflow to executable instructions
 */
async function translateToExecutableInstructions(atomicSop: SOPDocument): Promise<SOPDocument> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
  
  // Create prompt to translate atomic steps to Stagehand instructions
  const atomicSopJson = JSON.stringify(atomicSop, null, 2);
  const combinedPrompt = `${TECHNICAL_TRANSLATOR_PROMPT}

Please translate this atomic, UI-aware SOP into executable browser automation instructions:

${atomicSopJson}`;
  
  return await executeAIGeneration(model, combinedPrompt, 'Technical Translation');
}

/**
 * Legacy single-step browser automation generation (fallback)
 */
async function generateLegacyBrowserAutomation(sop: SOPDocument): Promise<SOPDocument> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
  
  // Use the old enhancement prompt as fallback
  const sopJson = JSON.stringify(sop, null, 2);
  const legacyPrompt = `You are an AEF enhancement assistant. Please enhance the provided SOP with browser automation instructions.

Please enhance this SOP with browser automation instructions:

${sopJson}`;
  
  return await executeAIGeneration(model, legacyPrompt, 'Legacy Enhancement');
}

/**
 * Generic AI generation with retry logic and error handling
 */
async function executeAIGeneration(model: any, prompt: string, processName: string): Promise<SOPDocument> {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let enhancedSop: SOPDocument | null = null;
  
  while (attempt < MAX_RETRIES && !enhancedSop) {
    attempt++;
    console.log(`🤖 ${processName} attempt ${attempt}...`);
    
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Log first 500 chars for debugging
      console.log(`📝 ${processName} response (first 500 chars): ${text.substring(0, 500)}...`);
      
      enhancedSop = parseAndValidateAIResponse(text);
      
      if (enhancedSop) {
        console.log(`✅ ${processName} successful with ${enhancedSop?.public?.nodes?.length || 0} nodes`);
        
        // Count automation-enhanced nodes for atomic approach
        const automatedNodeCount = enhancedSop.public.nodes.filter(node => 
          (node as any).automation?.automatable === true || (node as any).ui_context
        ).length;
        
        console.log(`🎯 Enhanced SOP has ${automatedNodeCount} atomic/automated steps`);
      }
      
    } catch (error) {
      console.error(`❌ Error during ${processName} attempt ${attempt}:`, error);
    }
    
    // Wait before retry
    if (!enhancedSop && attempt < MAX_RETRIES) {
      console.log(`⏳ Waiting 3 seconds before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  if (!enhancedSop) {
    throw new Error(`${processName} failed after ${MAX_RETRIES} attempts`);
  }
  
  return enhancedSop;
}

/**
 * Parse and validate AI response with fallback JSON extraction
 */
function parseAndValidateAIResponse(text: string): SOPDocument | null {
  // Clean up the response text
  let cleanedText = text;
  
  // Remove markdown code blocks if present
  if (text.includes('```json') || text.includes('```')) {
    cleanedText = text.replace(/```json\n|\n```|```/g, '');
  }
  
  // Trim whitespace
  cleanedText = cleanedText.trim();
  
  // Extract JSON if it's embedded in other text
  const firstBrace = cleanedText.indexOf('{');
  const lastBrace = cleanedText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
  }
  
  try {
    const enhancedSop = JSON.parse(cleanedText);
    
    // Validate that the enhanced SOP maintains the original structure
    if (!enhancedSop?.meta?.id || !enhancedSop?.public?.nodes) {
      throw new Error('Enhanced SOP missing required fields');
    }
    
    return enhancedSop;
    
  } catch (parseError) {
    console.error('❌ Invalid JSON from AI response:', parseError);
    console.error('🔍 Cleaned text (first 500 chars):', cleanedText.substring(0, 500) + '...');
    
    // Try fallback JSON extraction
    try {
      const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
      const jsonMatches = cleanedText.match(jsonRegex);
      
      if (jsonMatches && jsonMatches.length > 0) {
        const largestMatch = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        const fallbackSop = JSON.parse(largestMatch);
        console.log(`✅ Successfully extracted SOP using fallback method`);
        return fallbackSop;
      }
    } catch (fallbackError) {
      console.error('❌ Fallback JSON extraction also failed:', fallbackError);
    }
  }
  
  return null;
}

/**
 * Generate default checkpoint configuration for all SOP steps
 */
function generateDefaultCheckpoints(sop: SOPDocument): CheckpointConfig[] {
  const checkpoints: CheckpointConfig[] = [];
  
  if (!sop.public?.nodes) {
    return checkpoints;
  }

  // Create "before execution" checkpoint for each step node
  sop.public.nodes.forEach(node => {
    if (node.type === 'step' || node.type === 'task' || node.type === 'ui_interaction') {
      // Check if this step has automation instructions
      const hasAutomation = (node as any).automation?.automatable === true;
      const confidenceLevel = (node as any).automation?.confidence_level || 'medium';
      const isAtomic = !!(node as any).ui_context;
      
      checkpoints.push({
        id: `checkpoint_${node.id}`,
        stepId: node.id,
        type: CheckpointType.BEFORE_EXECUTION,
        condition: CheckpointCondition.ALWAYS,
        required: true,
        description: hasAutomation 
          ? `About to execute ${isAtomic ? 'atomic' : 'automated'} step: ${node.label || node.intent || 'Step'} (${confidenceLevel} confidence)`
          : `About to execute: ${node.label || node.intent || 'Step'}`,
        timeout: 300, // 5 minutes for approval
        defaultAction: CheckpointAction.REJECT
      });
    }
  });

  return checkpoints;
}

/**
 * Estimate execution duration based on number of steps and automation complexity
 */
function estimateExecutionDuration(sop: SOPDocument): number {
  if (!sop.public?.nodes) {
    return 5; // Default 5 minutes
  }

  let totalDuration = 0;
  
  sop.public.nodes.forEach(node => {
    if (node.type === 'step' || node.type === 'task' || node.type === 'ui_interaction') {
      const automation = (node as any).automation;
      
      if (automation?.automatable && automation.estimated_duration_ms) {
        // Use AI-provided duration estimate
        totalDuration += automation.estimated_duration_ms;
      } else if ((node as any).ui_context) {
        // Atomic steps are generally faster
        totalDuration += 90000; // 1.5 minutes per atomic step
      } else {
        // Default estimate: 2 minutes per step
        totalDuration += 120000; // 2 minutes in milliseconds
      }
    }
  });
  
  // Convert to minutes and ensure minimum duration
  const durationMinutes = Math.max(totalDuration / 60000, 5);
  
  console.log(`⏱️ Estimated execution duration: ${durationMinutes.toFixed(1)} minutes`);
  
  return Math.ceil(durationMinutes);
} 