def calculate_traffic_impact(roads, intervention):
    intervention_type = intervention.get("type", "NONE")
    affected = []
    for road in roads:
        props = road.get("properties", {})
        volume = float(props.get("trafficVolume", road.get("trafficVolume", 300)))
        width = float(props.get("width", road.get("width", 8)))
        speed = float(props.get("speedKph", road.get("speedKph", 30)))
        impact = 0.0
        if intervention_type == "ROAD":
            current = float(intervention.get("currentWidth", width))
            proposed = float(intervention.get("proposedWidth", current))
            if props.get("id", road.get("id")) == intervention.get("roadId"):
                width_delta = proposed - current
                impact = -min(0.25, max(-0.2, width_delta / max(current, 1) * 0.5))
        affected.append({"id":props.get("id",road.get("id")),"trafficVolume":round(volume),"estimatedTravelTimeIndex":round(max(0.65,1.0+(volume/1800)-impact),2),"width":width,"speedKph":speed})
    return affected
