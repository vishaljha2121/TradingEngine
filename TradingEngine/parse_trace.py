import json
from collections import defaultdict

def analyze_speedscope(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)

    frames = data['shared']['frames']
    profiles = data['profiles']

    if not profiles:
        print("No profiles found in the speedscope file.")
        return

    # Usually profiles[0] is the main trace
    profile = profiles[0]
    
    # speedscope format can be either 'evented' or 'sampled'
    profile_type = profile.get('type')
    
    counts = defaultdict(int)

def analyze_speedscope(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)

    frames = data['shared']['frames']
    profile = data['profiles'][0]
    
    counts = defaultdict(float) # Store cumulative time (self-time)

    events = profile['events']
    stack = []
    last_time = 0

    for event in events:
        event_type = event['type']
        frame_idx = event['frame']
        current_time = event['at']
        
        # Add elapsed time since last event to the currently active frame (top of stack)
        if stack:
            active_frame = stack[-1]
            counts[active_frame] += (current_time - last_time)

        if event_type == 'O': # Open (push)
            stack.append(frame_idx)
        elif event_type == 'C': # Close (pop)
            if stack:
                stack.pop()

        last_time = current_time

    # Sort by self-time descending
    sorted_frames = sorted(counts.items(), key=lambda x: x[1], reverse=True)

    print("Top 30 Hot CPU Frames (by estimated Self-Time):")
    print("-" * 80)
    for frame_idx, total_time in sorted_frames[:40]:
        frame_name = frames[frame_idx]['name']
        print(f"{total_time:12.2f} : {frame_name}")

if __name__ == "__main__":
    analyze_speedscope('profiler.speedscope.speedscope.json')
