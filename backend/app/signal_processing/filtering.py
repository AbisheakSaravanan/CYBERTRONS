from scipy.signal import butter, sosfiltfilt
import numpy as np

def lowpass_filter(
    signal,
    sampling_rate,
    cutoff=5,
    order=4
):
    signal_arr = np.asarray(signal)
    # Check if the signal is long enough for the filter order
    # sosfiltfilt requires signal length > 3 * (max(len(b), len(a)) - 1)
    # For order 4, the filter size is around 5.
    min_len = 3 * (order + 1)
    if len(signal_arr) < min_len:
        # Return as is or repeat/pad to filter it safely
        return signal_arr

    sos = butter(
        order,
        cutoff,
        btype="lowpass",
        fs=sampling_rate,
        output="sos"
    )

    filtered = sosfiltfilt(
        sos,
        signal_arr,
        axis=0
    )

    return filtered
