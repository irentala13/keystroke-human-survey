import os
import json
import pandas as pd
import numpy as np


# ---------------------------------------------------------------------
# Utility: convert NumPy / Pandas values to native Python types
# ---------------------------------------------------------------------
def make_json_serializable(obj):
    """Recursively convert numpy and pandas types to pure Python types."""
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(v) for v in obj]
    elif isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (pd.Timestamp, np.datetime64)):
        return str(obj)
    else:
        return obj


# ---------------------------------------------------------------------
# 1. KHT computation
# ---------------------------------------------------------------------
def compute_kht_per_key(file_path):
    df = pd.read_csv(file_path, header=0)
    # Handle both "Action" and "Press or Release" column names
    action_col = "Press or Release" if "Press or Release" in df.columns else "Action"
    df.rename(columns={action_col: "Action"}, inplace=True)
    df.sort_values(by=["Key", "Time"], inplace=True)

    results = []
    for key, group in df.groupby("Key"):
        stack = []
        kht_list = []
        for _, row in group.iterrows():
            if row["Action"] == "P":
                stack.append(row["Time"])
            elif row["Action"] == "R" and stack:
                press_time = stack.pop(0)
                kht_list.append(row["Time"] - press_time)
        if kht_list:
            results.append({
                "Key": key,
                "Average_KHT": float(sum(kht_list) / len(kht_list)),
                "Samples": int(len(kht_list)),
                "Median_KHT": float(pd.Series(kht_list).median()),
                "StdDev_KHT": float(pd.Series(kht_list).std())
            })

    result_df = pd.DataFrame(results).sort_values("Average_KHT").reset_index(drop=True)
    avg_kht = float(result_df["Average_KHT"].mean()) if not result_df.empty else 0.0
    return result_df, avg_kht


# ---------------------------------------------------------------------
# 2. KIT computation
# ---------------------------------------------------------------------
def compute_key_intervals(file_path, negative_threshold=-100):
    df = pd.read_csv(file_path, header=0)
    # Handle both "Action" and "Press or Release" column names
    action_col = "Press or Release" if "Press or Release" in df.columns else "Action"
    df.rename(columns={action_col: "Action"}, inplace=True)
    df.sort_values(by="Time", inplace=True)
    pairs, stacks = [], {}

    for _, row in df.iterrows():
        key, time = row["Key"], row["Time"]
        if row["Action"] == "P":
            stacks.setdefault(key, []).append(time)
        elif row["Action"] == "R" and stacks.get(key):
            press_time = stacks[key].pop(0)
            pairs.append({"Key": key, "PressTime": press_time, "ReleaseTime": time})

    pairs_df = pd.DataFrame(pairs).sort_values("PressTime").reset_index(drop=True)
    intervals = []
    for i in range(len(pairs_df) - 1):
        current_release = pairs_df.loc[i, "ReleaseTime"]
        next_press = pairs_df.loc[i + 1, "PressTime"]
        intervals.append({
            "FromKey": pairs_df.loc[i, "Key"],
            "ToKey": pairs_df.loc[i + 1, "Key"],
            "Interval_ms": float(next_press - current_release)
        })

    intervals_df = pd.DataFrame(intervals)
    valid_intervals = intervals_df[intervals_df["Interval_ms"] > negative_threshold].reset_index(drop=True)
    avg_kit = float(valid_intervals["Interval_ms"].mean()) if not valid_intervals.empty else 0.0
    return valid_intervals, avg_kit


# ---------------------------------------------------------------------
# 3. Pause histogram (normalized)
# ---------------------------------------------------------------------
def compute_normalized_pause_histogram(intervals_df, bins=None, pause_threshold=250):
    pauses = intervals_df[intervals_df["Interval_ms"] > pause_threshold]["Interval_ms"]
    if pauses.empty:
        return pd.DataFrame()

    if bins is None:
        bins = [0, 250, 500, 1000, 2000, 3000, 5000, 10000]

    hist, bin_edges = pd.cut(pauses, bins=bins, right=False, include_lowest=True, retbins=True)
    counts = hist.value_counts().sort_index()
    normalized = counts / counts.sum()

    return pd.DataFrame({
        "BinRange": [f"{int(bin_edges[i])}-{int(bin_edges[i+1])} ms" for i in range(len(bin_edges)-1)],
        "Proportion": normalized.astype(float).values
    })


# ---------------------------------------------------------------------
# 4. Burst computation + histogram
# ---------------------------------------------------------------------
def compute_bursts(intervals_df, pause_threshold=250):
    intervals = intervals_df.copy().reset_index(drop=True)
    bursts, current_burst = [], {"Keys": [intervals.loc[0, "FromKey"]]}

    for i in range(len(intervals)):
        interval = intervals.loc[i, "Interval_ms"]
        to_key = intervals.loc[i, "ToKey"]
        if interval <= pause_threshold:
            current_burst["Keys"].append(to_key)
        else:
            bursts.append({
                "BurstID": len(bursts) + 1,
                "Keys": current_burst["Keys"],
                "KeyCount": len(current_burst["Keys"])
            })
            current_burst = {"Keys": [to_key]}

    if current_burst["Keys"]:
        bursts.append({
            "BurstID": len(bursts) + 1,
            "Keys": current_burst["Keys"],
            "KeyCount": len(current_burst["Keys"])
        })

    bursts_df = pd.DataFrame(bursts)
    counts = bursts_df["KeyCount"].value_counts().sort_index()
    normalized = counts / counts.sum()

    burst_hist = pd.DataFrame({
        "BurstLength_Keys": counts.index.astype(int),
        "Proportion": normalized.astype(float).values
    })
    return bursts_df, burst_hist


# ---------------------------------------------------------------------
# 5. WPM computation
# ---------------------------------------------------------------------
def compute_wpm(text_file_path, keystroke_file_path):
    df = pd.read_csv(keystroke_file_path, header=0)
    # Ensure Time column exists
    if "Time" not in df.columns:
        raise ValueError(f"CSV file {keystroke_file_path} missing 'Time' column")
    max_time, min_time = df["Time"].max(), df["Time"].min()
    duration_ms = float(max_time - min_time)

    with open(text_file_path, "r", encoding="utf-8") as f:
        words = f.read().split()

    wpm = (len(words) / duration_ms) * 60000 if duration_ms > 0 else 0.0
    return float(wpm), int(len(words)), duration_ms


# ---------------------------------------------------------------------
# 6. Unified feature extraction
# ---------------------------------------------------------------------
def extract_keystroke_features(text_file_path, keystroke_file_path):
    wpm, word_count, duration_ms = compute_wpm(text_file_path, keystroke_file_path)
    kht_df, avg_kht = compute_kht_per_key(keystroke_file_path)
    kit_df, avg_kit = compute_key_intervals(keystroke_file_path)
    pause_hist = compute_normalized_pause_histogram(kit_df)
    _, burst_hist = compute_bursts(kit_df)

    features = {
        "WPM": wpm,
        "WordCount": word_count,
        "Duration_ms": duration_ms,
        "Average_KHT": avg_kht,
        "Average_KIT": avg_kit,
        "PauseHistogram": pause_hist.to_dict(orient="records") if not pause_hist.empty else [],
        "BurstHistogram": burst_hist.to_dict(orient="records") if not burst_hist.empty else []
    }

    return make_json_serializable(features)


# ---------------------------------------------------------------------
# 7. Process all users and write JSON files
# ---------------------------------------------------------------------
if __name__ == "__main__":
    # Updated paths for new directory structure
    base_dir = r"/Users/irentala/PycharmProjects/web-data-collection-gcs/2025-08-31_12-33-58_loris-mbp-cable-rcn-com/cleaned_data/desktop"
    raw_data_dir = os.path.join(base_dir, "raw_data")
    text_dir = os.path.join(base_dir, "text")
    output_dir = os.path.join(base_dir, "features_json")
    os.makedirs(output_dir, exist_ok=True)

    # Get all user directories from raw_data
    if not os.path.exists(raw_data_dir):
        print(f"Error: Raw data directory not found: {raw_data_dir}")
        exit(1)

    user_dirs = [d for d in os.listdir(raw_data_dir) 
                 if os.path.isdir(os.path.join(raw_data_dir, d))]

    total_files_processed = 0
    total_files_skipped = 0

    for user_id in sorted(user_dirs):
        user_raw_dir = os.path.join(raw_data_dir, user_id)
        user_text_dir = os.path.join(text_dir, user_id)

        if not os.path.exists(user_text_dir):
            print(f"  Skipping {user_id}: text directory not found")
            continue

        # Get all CSV files for this user
        csv_files = [f for f in os.listdir(user_raw_dir) if f.endswith('.csv')]
        
        if not csv_files:
            print(f"  Skipping {user_id}: no CSV files found")
            continue

        print(f"\n Processing user: {user_id} ({len(csv_files)} CSV files)")

        # Process each CSV file
        for csv_file in sorted(csv_files):
            csv_path = os.path.join(user_raw_dir, csv_file)
            
            # Find matching text file (same filename but .txt extension)
            file_stem = os.path.splitext(csv_file)[0]  # Remove .csv extension
            txt_file = file_stem + ".txt"
            txt_path = os.path.join(user_text_dir, txt_file)

            if not os.path.exists(txt_path):
                print(f"Skipping {csv_file}: matching text file not found ({txt_file})")
                total_files_skipped += 1
                continue

            try:
                print(f"  🔄 Processing {csv_file}...")
                features = extract_keystroke_features(txt_path, csv_path)

                # Create output filename: user_id_filename_features.json
                output_filename = f"{user_id}_{file_stem}_features.json"
                json_path = os.path.join(output_dir, output_filename)
                
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(features, f, indent=4)

                print(f"Saved {output_filename}")
                total_files_processed += 1
            except Exception as e:
                print(f"Error processing {csv_file}: {e}")
                total_files_skipped += 1
                continue

    print(f"\n{'='*60}")
    print(f"Processing complete!")
    print(f"   Files processed: {total_files_processed}")
    print(f"   Files skipped: {total_files_skipped}")
    print(f"   Output directory: {output_dir}")
    print(f"{'='*60}")
