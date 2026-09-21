from .config import RUNOFF_COEFFICIENTS, CELL_AREA_M2


def runoff_coefficient(land_use, extra_impervious=0.0):
    base = RUNOFF_COEFFICIENTS.get(land_use.upper(), RUNOFF_COEFFICIENTS["SOIL"])
    return min(0.95, max(0.05, base + extra_impervious))


def calculate_runoff(rainfall_mm, land_use, extra_impervious=0.0, cell_area_m2=CELL_AREA_M2):
    coefficient = runoff_coefficient(land_use, extra_impervious)
    runoff_mm = rainfall_mm * coefficient
    runoff_m3 = runoff_mm / 1000.0 * cell_area_m2
    return {
        "coefficient": round(coefficient, 3),
        "runoffMm": round(runoff_mm, 3),
        "runoffM3": round(runoff_m3, 3),
    }
