import numpy as np
from .parser import parse_csi
from .amplitude import get_amplitude
from .phase import get_phase, correct_phase
from .filtering import lowpass_filter
from .windowing import create_windows

def process_single_packet(iq_data):
    """
    Processes a single packet's raw IQ data.
    Returns parsed CSI, amplitude, and raw phase.
    """
    csi = parse_csi(iq_data)
    amplitude = get_amplitude(csi)
    phase = get_phase(csi)
    return {
        "csi": csi,
        "amplitude": amplitude,
        "phase": phase
    }

def process_csi_window(
    packets_iq,
    sampling_rate=20,
    cutoff=5,
    window_size=10,
    step=5
):
    """
    Processes a series of raw IQ packets in a window.
    Applies parsing, amplitude/phase extraction, phase correction, lowpass filtering, and windowing.
    """
    complex_csi = []
    for p in packets_iq:
        complex_csi.append(parse_csi(p))
    
    complex_csi = np.array(complex_csi)  # shape: (num_packets, num_subcarriers)
    amplitude = np.abs(complex_csi)
    phase = np.angle(complex_csi)
    
    # Phase correction for each subcarrier across time
    corrected_phase = np.zeros_like(phase)
    if phase.ndim == 2:
        for col in range(phase.shape[1]):
            corrected_phase[:, col] = correct_phase(phase[:, col])
    else:
        corrected_phase = correct_phase(phase)
        
    # Lowpass filter amplitude across time
    filtered_amplitude = lowpass_filter(
        amplitude,
        sampling_rate=sampling_rate,
        cutoff=cutoff
    )
    
    # Windowing
    amplitude_windows = create_windows(
        filtered_amplitude,
        window_size=window_size,
        step=step
    )
    
    phase_windows = create_windows(
        corrected_phase,
        window_size=window_size,
        step=step
    )
    
    return {
        "complex_csi": complex_csi,
        "amplitude": amplitude,
        "phase": phase,
        "corrected_phase": corrected_phase,
        "filtered_amplitude": filtered_amplitude,
        "amplitude_windows": amplitude_windows,
        "phase_windows": phase_windows
    }
