#!/usr/bin/env python3
"""
Test script to verify the API can handle array format transcript data
"""

import requests
import json

# Sample data that mimics what the frontend is sending
test_data = {
    "job_id": "72e3eaa7-b723-4797-b7ae-4c7d2c1a901f",
    "sop_data": {
        "job_id": "72e3eaa7-b723-4797-b7ae-4c7d2c1a901f",
        "status": "completed",
        "created_at": "2025-05-23T20:02:29.561+00:00",
        "metadata": {"user_id": "e68b0753-328b-40f5-adab-92095f359120"}
    },
    "transcript": [
        {
            "timestamp_end_audio": "00:00:08.105",
            "timestamp_start_audio": "00:00:00.335",
            "verbatim_transcript_segment": "Alright, so the workflow that I'm going to show you today is something that I have to do every evening."
        },
        {
            "action_type_observed": "SCREEN_UPDATE",
            "application_in_focus": "Google Chrome - New Tab",
            "timestamp_start_visual": "00:00:00.335",
            "screen_region_description_pre_action": "Google Chrome new tab page is displayed with Google logo, search bar, and frequently visited sites below.",
            "screen_region_description_post_action": "Screen state remains the same."
        },
        {
            "timestamp_end_audio": "00:00:10.975",
            "timestamp_start_audio": "00:00:08.105",
            "verbatim_transcript_segment": "So um, I'm we're currently fundraising and um"
        },
        {
            "data_input_observed": {},
            "action_type_observed": "CLICK",
            "application_in_focus": "Google Chrome - New Tab",
            "target_element_details": {
                "element_type_guess": "TAB",
                "element_visible_text": "Inbox (14) - michaelburner55@...",
                "element_bounding_box_pixels": [159, 8, 186, 30]
            },
            "timestamp_start_visual": "00:00:07.735",
            "screen_region_description_pre_action": "Mouse cursor hovering over the tab labeled 'Inbox (14) - michaelburner55@...'.",
            "screen_region_description_post_action": "Screen updated to show the Gmail inbox for michaelburner55@... . The active tab changed."
        },
        {
            "data_input_observed": {"typed_characters": "airtable.com"},
            "action_type_observed": "TYPE",
            "application_in_focus": "Google Chrome - New Tab",
            "target_element_details": {
                "element_type_guess": "INPUT_FIELD",
                "element_visible_text": "Search Google or type a URL"
            },
            "timestamp_start_visual": "00:01:05.575",
            "screen_region_description_pre_action": "Google search bar is visible on the new tab page.",
            "screen_region_description_post_action": "Text 'airtable.com' appeared in the search/address bar."
        }
    ]
}

def test_api():
    """Test the API with array format transcript"""
    print("🧪 Testing API with array format transcript...")
    
    try:
        response = requests.post(
            "http://localhost:8000/api/ai-orchestrate",
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success! Generated {len(result['steps'])} steps")
            print(f"📋 Title: {result['title']}")
            print(f"⏱️ Estimated Duration: {result['estimated_duration']}s")
            print(f"🎯 Risk Level: {result['risk_assessment']['overall_risk']}")
            
            # Show first few steps
            print("\n📝 First 3 steps:")
            for i, step in enumerate(result['steps'][:3]):
                print(f"  {i+1}. {step['name']} ({step['confidence']} confidence)")
                
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_api() 