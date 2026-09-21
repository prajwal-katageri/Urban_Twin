import heapq
import math


# =========================================================
# DISTANCE
# =========================================================

def _distance(a, b):
    lat_scale = 111.32

    lon_scale = (
        111.32
        * math.cos(
            math.radians(
                (a[1] + b[1]) / 2
            )
        )
    )

    dx = (
        (a[0] - b[0])
        * lon_scale
    )

    dy = (
        (a[1] - b[1])
        * lat_scale
    )

    return math.hypot(dx, dy)


# =========================================================
# ROAD SPEED
# =========================================================

def _default_speed(highway):
    return {
        "motorway": 80,
        "trunk": 60,
        "primary": 50,
        "secondary": 40,
        "tertiary": 35,
        "unclassified": 30,
        "residential": 25,
        "living_street": 15,
        "service": 15,
        "road": 25
    }.get(
        str(highway).lower(),
        25
    )


# =========================================================
# BUILD INTERNAL GRAPH
# =========================================================

def _build_graph(roads):

    graph = {}

    for road in roads:

        coords = road.get(
            "geometry",
            {}
        ).get(
            "coordinates",
            []
        )

        props = road.get(
            "properties",
            {}
        )

        road_id = props.get(
            "id",
            road.get("id")
        )

        if len(coords) < 2:
            continue

        highway = props.get(
            "highway",
            "road"
        )

        speed = props.get(
            "speedKph"
        )

        if speed is None:
            speed = _default_speed(
                highway
            )

        try:
            speed = float(speed)
        except Exception:
            speed = _default_speed(
                highway
            )

        # -------------------------------------------------
        # Keep detailed geometry internally for routing.
        # -------------------------------------------------

        previous = None

        for coordinate in coords:

            current = (
                round(
                    float(coordinate[0]),
                    7
                ),
                round(
                    float(coordinate[1]),
                    7
                )
            )

            if previous is None:
                previous = current
                graph.setdefault(
                    current,
                    []
                )
                continue

            if current == previous:
                continue

            length_km = max(
                0.001,
                _distance(
                    previous,
                    current
                )
            )

            edge = {
                "id": road_id,
                "name": props.get(
                    "name",
                    "Road"
                ),
                "highway": highway,
                "lengthKm": length_km,
                "speedKph": speed,
                "source": "OpenStreetMap"
            }

            graph.setdefault(
                previous,
                []
            ).append(
                (
                    current,
                    edge
                )
            )

            graph.setdefault(
                current,
                []
            ).append(
                (
                    previous,
                    edge
                )
            )

            previous = current

    return graph


# =========================================================
# SIMPLIFIED GRAPH FOR UI
# =========================================================

def _build_display_graph(
    graph,
    blocked,
    start=None,
    goal=None
):
    """
    Compress long chains of degree-2 nodes.

    The internal graph keeps all OSM geometry points for
    routing, but the UI receives only important nodes:
    - intersections
    - dead ends
    - HOME
    - SAFE ZONE

    This prevents the routing modal from showing hundreds
    of unnecessary dots.
    """

    if not graph:
        return {
            "nodes": [],
            "edges": []
        }

    important = set()

    # -----------------------------------------------------
    # Keep intersections and endpoints.
    # -----------------------------------------------------

    for node, links in graph.items():

        if len(links) != 2:
            important.add(node)

    # -----------------------------------------------------
    # Always keep HOME and SAFE nodes.
    # -----------------------------------------------------

    if start is not None:
        important.add(start)

    if goal is not None:
        important.add(goal)

    # -----------------------------------------------------
    # Build collapsed edges.
    # -----------------------------------------------------

    display_edges = []

    visited_segments = set()

    for source in important:

        for neighbor, first_edge in graph.get(
            source,
            []
        ):

            segment_key = tuple(
                sorted(
                    [
                        source,
                        neighbor
                    ]
                )
            )

            if segment_key in visited_segments:
                continue

            current = neighbor
            previous = source

            total_length = first_edge[
                "lengthKm"
            ]

            speeds = [
                float(
                    first_edge.get(
                        "speedKph",
                        25
                    )
                )
            ]

            road_ids = [
                str(
                    first_edge.get(
                        "id"
                    )
                )
            ]

            road_names = [
                first_edge.get(
                    "name",
                    "Road"
                )
            ]

            highways = [
                first_edge.get(
                    "highway",
                    "road"
                )
            ]

            visited_segments.add(
                segment_key
            )

            # -------------------------------------------------
            # Follow the chain until another important node.
            # -------------------------------------------------

            while current not in important:

                next_links = [
                    item
                    for item in graph.get(
                        current,
                        []
                    )
                    if item[0] != previous
                ]

                if not next_links:
                    break

                next_node, next_edge = (
                    next_links[0]
                )

                segment_key = tuple(
                    sorted(
                        [
                            current,
                            next_node
                        ]
                    )
                )

                if segment_key in visited_segments:
                    break

                visited_segments.add(
                    segment_key
                )

                total_length += next_edge[
                    "lengthKm"
                ]

                speeds.append(
                    float(
                        next_edge.get(
                            "speedKph",
                            25
                        )
                    )
                )

                road_ids.append(
                    str(
                        next_edge.get(
                            "id"
                        )
                    )
                )

                road_names.append(
                    next_edge.get(
                        "name",
                        "Road"
                    )
                )

                highways.append(
                    next_edge.get(
                        "highway",
                        "road"
                    )
                )

                previous = current
                current = next_node

            # -------------------------------------------------
            # We reached another important node.
            # -------------------------------------------------

            if current in important:

                edge_id = road_ids[0]

                is_blocked = any(
                    rid in blocked
                    for rid in road_ids
                )

                display_edges.append({
                    "id": edge_id,

                    "roadIds": road_ids,

                    "name": (
                        road_names[0]
                        if road_names
                        else "Road"
                    ),

                    "highway": (
                        highways[0]
                        if highways
                        else "road"
                    ),

                    "lengthKm": round(
                        total_length,
                        4
                    ),

                    "speedKph": round(
                        sum(speeds)
                        / max(len(speeds), 1),
                        1
                    ),

                    "fromPoint": [
                        source[0],
                        source[1]
                    ],

                    "toPoint": [
                        current[0],
                        current[1]
                    ],

                    "blocked": is_blocked
                })

    # -----------------------------------------------------
    # Create node IDs.
    # -----------------------------------------------------

    nodes = list(important)

    node_ids = {}

    node_payload = []

    for index, point in enumerate(
        nodes
    ):

        node_id = f"N{index + 1}"

        node_ids[point] = node_id

        node_payload.append({
            "id": node_id,
            "coordinates": [
                point[0],
                point[1]
            ]
        })

    # -----------------------------------------------------
    # Convert display edges to node IDs.
    # -----------------------------------------------------

    edges = []

    seen = set()

    for edge in display_edges:

        from_point = tuple(
            edge["fromPoint"]
        )

        to_point = tuple(
            edge["toPoint"]
        )

        if (
            from_point not in node_ids
            or to_point not in node_ids
        ):
            continue

        from_id = node_ids[
            from_point
        ]

        to_id = node_ids[
            to_point
        ]

        key = tuple(
            sorted(
                [
                    from_id,
                    to_id
                ]
            )
        ) + (
            edge["id"],
        )

        if key in seen:
            continue

        seen.add(key)

        edges.append({
            "id": edge["id"],
            "roadIds": edge["roadIds"],
            "name": edge["name"],
            "highway": edge["highway"],
            "lengthKm": edge["lengthKm"],
            "speedKph": edge["speedKph"],
            "from": from_id,
            "to": to_id,
            "blocked": edge["blocked"]
        })

    return {
        "nodes": node_payload,
        "edges": edges
    }


# =========================================================
# A* / DIJKSTRA
# =========================================================

def find_safe_route(
    roads,
    origin,
    destination,
    blocked_roads=None,
    algorithm="astar"
):

    blocked = set(
        str(x)
        for x in (
            blocked_roads or []
        )
    )

    graph = _build_graph(
        roads
    )

    if not graph:

        return {
            "route": [],
            "blockedRoads": list(
                blocked
            ),
            "distanceKm": 0,
            "travelTimeMin": 0,
            "status": "NO_ROADS",
            "algorithm": algorithm,
            "graph": {
                "nodes": [],
                "edges": []
            }
        }

    nodes = list(
        graph.keys()
    )

    # -----------------------------------------------------
    # Find nearest OSM graph node.
    # -----------------------------------------------------

    def nearest(point):

        p = tuple(
            map(
                float,
                point
            )
        )

        return min(
            nodes,
            key=lambda n:
            _distance(n, p)
        )

    # -----------------------------------------------------
    # Resolve HOME.
    # -----------------------------------------------------

    if (
        isinstance(
            origin,
            str
        )
        and origin.startswith("N")
    ):

        try:

            origin_index = (
                int(
                    origin[1:]
                ) - 1
            )

            start = nodes[
                origin_index
            ]

        except Exception:

            start = nearest(
                origin
            )

    else:

        start = nearest(
            origin
        )

    # -----------------------------------------------------
    # Resolve SAFE ZONE.
    # -----------------------------------------------------

    if (
        isinstance(
            destination,
            str
        )
        and destination.startswith("N")
    ):

        try:

            destination_index = (
                int(
                    destination[1:]
                ) - 1
            )

            goal = nodes[
                destination_index
            ]

        except Exception:

            goal = nearest(
                destination
            )

    else:

        goal = nearest(
            destination
        )

    if (
        start is None
        or goal is None
    ):

        return {
            "route": [],
            "blockedRoads": list(
                blocked
            ),
            "distanceKm": 0,
            "travelTimeMin": 0,
            "status": "NO_ROUTE",
            "algorithm": algorithm,
            "graph": {
                "nodes": [],
                "edges": []
            }
        }

    # -----------------------------------------------------
    # A* heuristic.
    # -----------------------------------------------------

    def heuristic(node):

        return _distance(
            node,
            goal
        )

    use_astar = (
        algorithm.lower()
        == "astar"
    )

    # -----------------------------------------------------
    # Priority queue.
    # -----------------------------------------------------

    pq = []

    heapq.heappush(
        pq,
        (
            0.0,
            start
        )
    )

    dist = {
        start: 0.0
    }

    prev = {}

    used = {}

    # -----------------------------------------------------
    # Search.
    # -----------------------------------------------------

    while pq:

        priority, node = (
            heapq.heappop(pq)
        )

        expected = (
            dist.get(
                node,
                float("inf")
            )
            + (
                heuristic(node)
                if use_astar
                else 0
            )
        )

        if (
            priority
            > expected + 1e-12
        ):
            continue

        if node == goal:
            break

        for neighbor, road in graph.get(
            node,
            []
        ):

            road_id = str(
                road.get("id")
            )

            if road_id in blocked:
                continue

            new_cost = (
                dist[node]
                + road["lengthKm"]
            )

            if (
                new_cost
                < dist.get(
                    neighbor,
                    float("inf")
                )
            ):

                dist[neighbor] = (
                    new_cost
                )

                prev[neighbor] = node

                used[neighbor] = road

                score = (
                    new_cost
                    + (
                        heuristic(
                            neighbor
                        )
                        if use_astar
                        else 0
                    )
                )

                heapq.heappush(
                    pq,
                    (
                        score,
                        neighbor
                    )
                )

    # -----------------------------------------------------
    # No route.
    # -----------------------------------------------------

    if (
        goal not in prev
        and goal != start
    ):

        display_graph = (
            _build_display_graph(
                graph,
                blocked,
                start,
                goal
            )
        )

        return {
            "route": [],
            "blockedRoads": list(
                blocked
            ),
            "distanceKm": 0,
            "travelTimeMin": 0,
            "status": "NO_ROUTE",
            "algorithm": algorithm,
            "graph": display_graph
        }

    # -----------------------------------------------------
    # Reconstruct path.
    # -----------------------------------------------------

    path_nodes = [
        goal
    ]

    current = goal

    while current != start:

        current = prev[
            current
        ]

        path_nodes.append(
            current
        )

    path_nodes.reverse()

    # -----------------------------------------------------
    # Route roads.
    # -----------------------------------------------------

    route_roads = []

    for i in range(
        1,
        len(path_nodes)
    ):

        road = used[
            path_nodes[i]
        ]

        route_roads.append(
            road
        )

    # -----------------------------------------------------
    # Route coordinates.
    # -----------------------------------------------------

    coords = [
        [
            point[0],
            point[1]
        ]
        for point in path_nodes
    ]

    # -----------------------------------------------------
    # Distance.
    # -----------------------------------------------------

    distance = sum(
        road["lengthKm"]
        for road in route_roads
    )

    # -----------------------------------------------------
    # Travel time.
    # -----------------------------------------------------

    travel_time = 0.0

    for road in route_roads:

        speed = max(
            float(
                road.get(
                    "speedKph",
                    25
                )
            ),
            5
        )

        travel_time += (
            road["lengthKm"]
            / speed
            * 60
        )

    # -----------------------------------------------------
    # Build simplified graph for UI.
    # -----------------------------------------------------

    graph_data = _build_display_graph(
        graph,
        blocked,
        start,
        goal
    )

    # -----------------------------------------------------
    # Find node IDs.
    # -----------------------------------------------------

    start_id = None
    goal_id = None

    for node in graph_data[
        "nodes"
    ]:

        coordinates = tuple(
            node["coordinates"]
        )

        if coordinates == start:
            start_id = node["id"]

        if coordinates == goal:
            goal_id = node["id"]

    # -----------------------------------------------------
    # Return result.
    # -----------------------------------------------------

    return {

        "route": {
            "type": "Feature",

            "properties": {
                "algorithm": algorithm
            },

            "geometry": {
                "type": "LineString",
                "coordinates": coords
            }
        },

        "blockedRoads": list(
            blocked
        ),

        "distanceKm": round(
            distance,
            2
        ),

        "travelTimeMin": round(
            travel_time,
            1
        ),

        "status": "ROUTE_FOUND",

        "algorithm": algorithm,

        "graph": graph_data,

        "originNode": start_id,

        "destinationNode": goal_id
    }