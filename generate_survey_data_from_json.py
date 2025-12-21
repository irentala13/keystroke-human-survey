#!/usr/bin/env python3
"""
Generate survey data JS file from pre-calculated JSON feature files
This script reads all feature JSON files and corresponding text files,
then generates a JavaScript file that can be loaded by the survey.
"""

import os
import json
from pathlib import Path

# Paths
FEATURES_JSON_DIR = Path("/Users/irentala/PycharmProjects/web-data-collection-gcs/2025-08-31_12-33-58_loris-mbp-cable-rcn-com/cleaned_data/desktop/features_json")
TEXT_DIR = Path("/Users/irentala/PycharmProjects/web-data-collection-gcs/2025-08-31_12-33-58_loris-mbp-cable-rcn-com/cleaned_data/desktop/text")
OUTPUT_JS_FILE = Path("/Users/irentala/PycharmProjects/web-data-collection-gcs/survey_data_from_json.js")

def load_text_content(user_id, filename_base):
    """Load text content from text file"""
    # filename_base is already in format: "platform_video_session_userid"
    # e.g., "1_1_1_02905a58d4d227f7db1be7407f133719"
    # Text file format: "platform_video_session_userid.txt"
    # e.g., "1_1_1_02905a58d4d227f7db1be7407f133719.txt"
    text_filename = filename_base + '.txt'
    text_path = TEXT_DIR / user_id / text_filename
    
    if text_path.exists():
        try:
            with open(text_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                print(f"✅ Loaded text: {text_filename} ({len(content)} chars)")
                return content
        except Exception as e:
            print(f"❌ Error reading {text_path}: {e}")
            return ""
    else:
        print(f"⚠️  Text file not found: {text_path}")
        return ""

def load_all_features():
    """Load all feature JSON files and corresponding text files"""
    all_data = []
    
    if not FEATURES_JSON_DIR.exists():
        print(f"Error: Features directory not found: {FEATURES_JSON_DIR}")
        return []
    
    # Get all JSON files
    json_files = list(FEATURES_JSON_DIR.glob("*_features.json"))
    print(f"Found {len(json_files)} feature JSON files")
    
    for json_file in sorted(json_files):
        try:
            # Load JSON features
            with open(json_file, 'r', encoding='utf-8') as f:
                features = json.load(f)
            
            # Extract user ID and filename base
            filename = json_file.stem  # Without .json extension (removes .json, but keeps _features)
            # Remove _features suffix if present
            if filename.endswith('_features'):
                filename = filename[:-9]  # Remove '_features' (9 characters)
            
            parts = filename.split('_')
            
            if len(parts) >= 4:
                user_id = parts[0]
                filename_base = '_'.join(parts[1:])  # Remove user_id prefix: e.g., "1_1_1_userid"
                
                # Load text content
                text_content = load_text_content(user_id, filename_base)
                
                all_data.append({
                    'filename': json_file.name,
                    'user_id': user_id,
                    'filename_base': filename_base,
                    'features': features,
                    'text_content': text_content
                })
            else:
                print(f"Warning: Unexpected filename format: {json_file.name}")
                
        except Exception as e:
            print(f"Error processing {json_file.name}: {e}")
            continue
    
    return all_data

def generate_text_pairs(all_data):
    """Generate text pairs from loaded data
    
    Creates a balanced mix of same-user and different-user pairs.
    Target: ~7 same-user pairs + ~2 different-user pairs (total 9)
    """
    pairs = []
    
    # Group by user ID
    user_groups = {}
    for data in all_data:
        user_id = data['user_id']
        if user_id not in user_groups:
            user_groups[user_id] = []
        user_groups[user_id].append(data)
    
    # Target counts (adjustable)
    TARGET_SAME_USER = 5
    TARGET_DIFFERENT_USER = 4
    TARGET_TOTAL = TARGET_SAME_USER + TARGET_DIFFERENT_USER
    
    # Create same-user pairs (target: 7)
    pair_id = 1
    for user_id, user_files in user_groups.items():
        if len(pairs) >= TARGET_SAME_USER:
            break
            
        if len(user_files) >= 2:
            # Pair first two files from same user
            file1 = user_files[0]
            file2 = user_files[1]
            
            pairs.append({
                'id': f'pair_{pair_id:03d}',
                'text1': {
                    'filename': file1['filename'],
                    'user_id': file1['user_id'],
                    'features': file1['features'],
                    'text_content': file1.get('text_content', '')
                },
                'text2': {
                    'filename': file2['filename'],
                    'user_id': file2['user_id'],
                    'features': file2['features'],
                    'text_content': file2.get('text_content', '')
                },
                'actualType': 'same_user',
                'difficulty': 'MEDIUM'
            })
            pair_id += 1
    
    # Create different-user pairs (target: 2)
    user_ids = list(user_groups.keys())
    different_user_count = 0
    used_for_different = set()  # Track users already used in different-user pairs
    
    # Use a more diverse pairing strategy: pair users that are further apart
    for i in range(len(user_ids)):
        if different_user_count >= TARGET_DIFFERENT_USER:
            break
        
        # Skip if this user is already used in a different-user pair
        if user_ids[i] in used_for_different:
            continue
            
        # Find a different user to pair with
        for j in range(i + 1, len(user_ids)):
            if user_ids[j] in used_for_different:
                continue
            
            user1_files = user_groups[user_ids[i]]
            user2_files = user_groups[user_ids[j]]
            
            if user1_files and user2_files:
                pairs.append({
                    'id': f'pair_{pair_id:03d}',
                    'text1': {
                        'filename': user1_files[0]['filename'],
                        'user_id': user1_files[0]['user_id'],
                        'features': user1_files[0]['features'],
                        'text_content': user1_files[0].get('text_content', '')
                    },
                    'text2': {
                        'filename': user2_files[0]['filename'],
                        'user_id': user2_files[0]['user_id'],
                        'features': user2_files[0]['features'],
                        'text_content': user2_files[0].get('text_content', '')
                    },
                    'actualType': 'different_users',
                    'difficulty': 'MEDIUM'
                })
                pair_id += 1
                different_user_count += 1
                used_for_different.add(user_ids[i])
                used_for_different.add(user_ids[j])
                break  # Move to next user
    
    # If we still don't have enough pairs, fill with same-user pairs
    if len(pairs) < TARGET_TOTAL:
        remaining = TARGET_TOTAL - len(pairs)
        for user_id, user_files in user_groups.items():
            if remaining <= 0:
                break
            if len(user_files) >= 2:
                # Check if this user already has a pair
                user_has_pair = any(p['text1']['user_id'] == user_id or 
                                  p['text2']['user_id'] == user_id 
                                  for p in pairs if p['actualType'] == 'same_user')
                
                if not user_has_pair:
                    file1 = user_files[0]
                    file2 = user_files[1] if len(user_files) > 1 else user_files[0]
                    
                    pairs.append({
                        'id': f'pair_{pair_id:03d}',
                        'text1': {
                            'filename': file1['filename'],
                            'user_id': file1['user_id'],
                            'features': file1['features'],
                            'text_content': file1.get('text_content', '')
                        },
                        'text2': {
                            'filename': file2['filename'],
                            'user_id': file2['user_id'],
                            'features': file2['features'],
                            'text_content': file2.get('text_content', '')
                        },
                        'actualType': 'same_user',
                        'difficulty': 'MEDIUM'
                    })
                    pair_id += 1
                    remaining -= 1
    
    return pairs

def generate_js_file(pairs):
    """Generate JavaScript file with embedded data"""
    js_content = f"""// Survey data generated from JSON feature files
// Generated automatically - do not edit manually

const SURVEY_DATA_FROM_JSON = {{
  "textPairs": {json.dumps(pairs, indent=2, ensure_ascii=False)},
  "metadata": {{
    "totalPairs": {len(pairs)},
    "dataSource": "pre_calculated_json_features",
    "description": "Keystroke features loaded from JSON files"
  }}
}};
"""
    
    return js_content

def main():
    print("🔄 Loading feature JSON files...")
    all_data = load_all_features()
    
    if not all_data:
        print("❌ No data loaded. Exiting.")
        return
    
    print(f"✅ Loaded {len(all_data)} feature files")
    
    print("🔄 Generating text pairs...")
    pairs = generate_text_pairs(all_data)
    
    print(f"✅ Generated {len(pairs)} text pairs")
    
    print("🔄 Generating JavaScript file...")
    js_content = generate_js_file(pairs)
    
    # Write to file
    with open(OUTPUT_JS_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"✅ Saved to: {OUTPUT_JS_FILE}")
    
    # Statistics
    same_user = sum(1 for p in pairs if p['actualType'] == 'same_user')
    diff_user = sum(1 for p in pairs if p['actualType'] == 'different_users')
    print(f"\n📊 Statistics:")
    print(f"   Same user pairs: {same_user}")
    print(f"   Different user pairs: {diff_user}")

if __name__ == "__main__":
    main()

