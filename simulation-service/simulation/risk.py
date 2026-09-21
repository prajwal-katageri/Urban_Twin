from .config import RISK_THRESHOLDS


def calculate_risk(depth_m):
    if depth_m >= RISK_THRESHOLDS["SEVERE"]:
        return "SEVERE"
    if depth_m >= RISK_THRESHOLDS["HIGH"]:
        return "HIGH"
    if depth_m >= RISK_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    return "LOW"
