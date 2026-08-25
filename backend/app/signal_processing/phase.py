import numpy as np

def get_phase(csi):
    phase = np.angle(csi)
    return phase

def unwrap_phase(phase):
    return np.unwrap(phase)

def correct_phase(phase):
    unwrapped = np.unwrap(phase)
    x = np.arange(len(unwrapped))
    # Avoid polyfit errors on empty or single value input
    if len(x) < 2:
        return unwrapped
    slope, intercept = np.polyfit(x, unwrapped, 1)
    trend = slope * x + intercept
    corrected = unwrapped - trend
    return corrected
