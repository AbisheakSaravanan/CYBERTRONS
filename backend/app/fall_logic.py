from typing import List, Dict

def detect_fall_staging(
    current_prediction: str,
    current_motion_energy: float,
    recent_predictions: List[str],
    recent_motion_energies: List[float]
) -> bool:
    """
    Evaluates whether the activity sequence indicates a possible fall staging.
    A fall is staged if:
      1. The current state is stillness ('lying' or 'no_movement').
      2. The recent history (e.g. last 10 samples, ~5-10 seconds) contains a 
         motion-energy spike (motion energy > 1.8 or prediction was 'walking' with high variance).
    """
    # 1. Check if the current state is stillness
    if current_prediction not in ["lying", "no_movement"]:
        return False
        
    # 2. Check for a motion-energy spike in the recent history
    # We look back at the recent motion energies or recent predictions.
    has_spike = False
    
    # Check recent motion energies for a value > 6.0
    for energy in recent_motion_energies[-12:]:  # look back ~6-12 samples
        if energy > 6.0:
            has_spike = True
            break
            
    # Also check if any recent prediction was walking with moderate/high energy
    if not has_spike:
        for idx, pred in enumerate(recent_predictions[-12:]):
            if pred == "walking":
                # Ensure it had reasonable motion energy
                corresponding_energy = recent_motion_energies[-12:][idx] if idx < len(recent_motion_energies[-12:]) else 0.0
                if corresponding_energy > 5.0:
                    has_spike = True
                    break
                    
    return has_spike
