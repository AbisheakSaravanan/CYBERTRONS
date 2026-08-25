import numpy as np

def create_windows(
    data,
    window_size=100,
    step=50
):
    windows = []
    # If the data is shorter than the window size, return at least one window
    # padded or as-is to avoid empty results.
    if len(data) < window_size:
        if len(data) == 0:
            return np.empty((0, window_size) if data.ndim == 1 else (0, window_size, data.shape[1]))
        # Pad with the last value to reach window_size
        padding_len = window_size - len(data)
        if data.ndim == 1:
            padded = np.pad(data, (0, padding_len), 'edge')
        else:
            padded = np.pad(data, ((0, padding_len), (0, 0)), 'edge')
        return np.array([padded])

    for start in range(0, len(data) - window_size + 1, step):
        end = start + window_size
        windows.append(data[start:end])
    return np.array(windows)
