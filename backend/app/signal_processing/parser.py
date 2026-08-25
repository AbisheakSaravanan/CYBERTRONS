import numpy as np

def parse_csi(iq_data):
    iq_data = np.asarray(iq_data, dtype=float)
    if len(iq_data) % 2 != 0:
        raise ValueError("Invalid CSI data length")
    real = iq_data[0::2]
    imag = iq_data[1::2]
    csi = real + 1j * imag
    return csi
