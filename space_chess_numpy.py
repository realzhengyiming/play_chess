"""NumPy 版空间棋排布引擎。

入口：generate_layouts(room, program, inventory_overrides, search_config)

坐标和尺寸单位均为米。家具数量配置代表上限；超过 min_count 的槽位会同时
搜索“摆放 / 跳过”。碰撞 broad-phase 使用 0.12 m NumPy uint64 Bitset，最终
仍用精确矩形与多边形检查兜底。
"""

from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass, field, replace
import json
import math
from pathlib import Path
import time
from typing import Any, Iterable, Mapping, Sequence

import numpy as np


EPS = 1e-9


# ---------------------------------------------------------------------------
# 1. 输入、配置和输出模型
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    w: float
    d: float

    @property
    def x0(self) -> float:
        return self.x - self.w / 2

    @property
    def x1(self) -> float:
        return self.x + self.w / 2

    @property
    def y0(self) -> float:
        return self.y - self.d / 2

    @property
    def y1(self) -> float:
        return self.y + self.d / 2


@dataclass(frozen=True)
class RoomInput:
    polygon: tuple[tuple[float, float], ...]
    door_no_go: Rect
    entry_point: tuple[float, float]
    windows: tuple[Rect, ...] = ()
    name: str = "room"


@dataclass(frozen=True)
class SizeVariant:
    id: str
    label: str
    w: float
    d: float


@dataclass(frozen=True)
class FurnitureRule:
    type_id: str
    label: str
    order: int
    default_w: float
    default_d: float
    default_max_count: int
    min_count: int = 0
    allowed_max_count: int = 1
    anchor: str = "free"          # wall / zone / relation / corner / free
    category: str = "comfort"
    color: str = "#777777"
    access_target: bool = False
    avoid_window: bool = False
    service_depth: float = 0.0
    service_hard: bool = False
    shape: str = "box"
    size_variants: tuple[SizeVariant, ...] = ()
    infill_min: float | None = None
    infill_max: float | None = None


@dataclass(frozen=True)
class FurnitureSlot:
    id: str
    type_id: str
    label: str
    w: float
    d: float
    optional: bool
    slot_index: int
    rule: FurnitureRule
    size_variants: tuple[SizeVariant, ...]


@dataclass(frozen=True)
class Pose:
    x: float
    y: float
    rotation: int
    w: float
    d: float
    relation: str = ""
    wall_index: int = -1
    normal: tuple[float, float] = (0.0, 1.0)
    wall_dir: tuple[float, float] = (1.0, 0.0)
    variant_id: str = "fixed"
    variant_label: str = "固定尺寸"
    relation_target: str = ""


@dataclass(frozen=True)
class Wall:
    index: int
    a: tuple[float, float]
    b: tuple[float, float]
    direction: tuple[float, float]
    inward: tuple[float, float]
    length: float
    horizontal: bool


@dataclass
class GridContext:
    room: RoomInput
    step: float
    min_x: float
    min_y: float
    cols: int
    rows: int
    xs: np.ndarray
    ys: np.ndarray
    room_cells: np.ndarray
    door_cells: np.ndarray
    room_words: np.ndarray
    door_words: np.ndarray
    walls: tuple[Wall, ...]
    profile_cache: dict[tuple[Any, ...], "CandidateProfile"] = field(default_factory=dict)

    @property
    def cell_count(self) -> int:
        return self.cols * self.rows


@dataclass(frozen=True)
class CandidateProfile:
    pose: Pose
    body_rects: tuple[Rect, ...]
    service_rects: tuple[Rect, ...]
    body_words: np.ndarray
    service_words: np.ndarray


@dataclass
class SearchState:
    poses: dict[str, Pose]
    occupancy: np.ndarray
    hard_service: np.ndarray
    partial_score: float
    path: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class Evaluation:
    total: float
    feasible: float
    function: float
    circulation: float
    relation: float
    composition: float
    storage: float
    comfort: float
    daylight: float
    hard_pass: bool
    actual_count: int
    density: float


@dataclass(frozen=True)
class LayoutResult:
    rank: int
    score: float
    evaluation: Evaluation
    furniture: tuple[dict[str, Any], ...]
    path: tuple[dict[str, Any], ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "rank": self.rank,
            "score": self.score,
            "scores": {
                "feasible": self.evaluation.feasible,
                "function": self.evaluation.function,
                "circulation": self.evaluation.circulation,
                "relation": self.evaluation.relation,
                "composition": self.evaluation.composition,
                "storage": self.evaluation.storage,
                "comfort": self.evaluation.comfort,
                "daylight": self.evaluation.daylight,
            },
            "hard_pass": self.evaluation.hard_pass,
            "actual_count": self.evaluation.actual_count,
            "density": self.evaluation.density,
            "furniture": list(self.furniture),
        }


@dataclass(frozen=True)
class SearchConfig:
    grid_step: float = 0.12
    beam_width: int = 96
    candidates_per_parent: int = 48
    output_limit: int = 12
    use_size_variants: bool = True
    keep_quantity_diversity: bool = True


@dataclass(frozen=True)
class SearchStats:
    program: str
    grid: tuple[int, int]
    slots: int
    expanded: int
    legal_candidates: int
    duplicate_states: int
    elapsed_ms: float
    final_beam: int
    output_count: int


# ---------------------------------------------------------------------------
# 2. 与 HTML 对应的家具库
# ---------------------------------------------------------------------------


BED_VARIANTS = (
    SizeVariant("single", "单人床", 1.20, 2.00),
    SizeVariant("double", "双人床", 1.50, 2.00),
    SizeVariant("king", "大床", 1.80, 2.00),
)

NIGHT_VARIANTS = (
    SizeVariant("slim", "窄床头柜", 0.35, 0.35),
    SizeVariant("standard", "标准床头柜", 0.45, 0.45),
    SizeVariant("wide", "宽床头柜", 0.55, 0.45),
)


def bedroom_rules() -> tuple[FurnitureRule, ...]:
    return (
        FurnitureRule("bed", "床", 0, 1.50, 2.00, 1, 1, 2, "wall", "core", "#2f6da0", True, False, 0.72, False, size_variants=BED_VARIANTS),
        FurnitureRule("wardrobe", "衣柜", 1, 1.80, 0.60, 1, 1, 1, "wall", "storage", "#9b6a46", True, True, 0.74, True),
        FurnitureRule("night", "床头柜", 2, 0.45, 0.45, 2, 0, 2, "relation", "comfort", "#6a8db2", False, False, 0.42, True, size_variants=NIGHT_VARIANTS),
        FurnitureRule("desk", "书桌", 3, 1.20, 0.60, 1, 0, 1, "wall", "work", "#2f8a78", True, False, 0.72, True),
        FurnitureRule("chair", "工作椅", 4, 0.50, 0.50, 1, 0, 1, "relation", "work", "#59a391", False, False, 0.48, False),
        FurnitureRule("vanity", "梳妆台", 5, 1.00, 0.45, 0, 0, 1, "wall", "work", "#a66f86", True, False, 0.64, True),
        FurnitureRule("vanityStool", "梳妆凳", 6, 0.42, 0.42, 0, 0, 1, "relation", "work", "#b78aa0", False, False, 0.42, False),
        FurnitureRule("bench", "床尾凳", 7, 1.10, 0.40, 0, 0, 1, "relation", "comfort", "#6686a2", False, False, 0.42, False),
        FurnitureRule("chest", "斗柜", 8, 1.00, 0.45, 0, 0, 2, "wall", "storage", "#a47b58", True, False, 0.66, True),
        FurnitureRule("shelf", "书柜", 9, 0.90, 0.35, 0, 0, 1, "wall", "storage", "#6d796f", True, True, 0.58, True),
        FurnitureRule("tvbench", "卧室电视柜", 10, 1.20, 0.40, 0, 0, 1, "wall", "leisure", "#505f69", True, True, 0.52, True),
        FurnitureRule("lounge", "休闲椅", 11, 0.72, 0.72, 0, 0, 2, "corner", "comfort", "#6b9888"),
        FurnitureRule("hamper", "洗衣篮", 12, 0.42, 0.42, 0, 0, 1, "corner", "storage", "#9b9070"),
    )


def living_rules() -> tuple[FurnitureRule, ...]:
    return (
        FurnitureRule("sofa", "沙发", 0, 2.20, 0.90, 1, 1, 1, "wall", "core", "#be633e", True, False, 0.78, False),
        FurnitureRule("tv", "电视柜", 1, 1.80, 0.45, 1, 1, 1, "wall", "core", "#34424d", True, True, 0.48, True),
        FurnitureRule("coffee", "茶几", 2, 1.20, 0.60, 1, 0, 1, "relation", "core", "#bd9252"),
        FurnitureRule("diningTable", "餐桌", 3, 1.40, 0.80, 0, 0, 1, "zone", "dining", "#8f704d", True, False, 0.52, False),
        FurnitureRule("diningChair", "餐椅", 4, 0.46, 0.50, 0, 0, 6, "relation", "dining", "#b08a64"),
        FurnitureRule("arm", "单人沙发", 5, 0.80, 0.80, 2, 0, 4, "relation", "comfort", "#d7895d"),
        FurnitureRule("side", "边几", 6, 0.50, 0.50, 1, 0, 2, "relation", "comfort", "#79927e"),
        FurnitureRule("ottoman", "脚凳", 7, 0.60, 0.50, 0, 0, 2, "relation", "comfort", "#aa7d67"),
        FurnitureRule("sideboard", "餐边柜", 8, 1.60, 0.45, 1, 0, 2, "wall", "storage", "#8b6a4e", True, False, 0.72, True),
        FurnitureRule("bookcase", "书柜 / 矮柜", 9, 1.20, 0.35, 0, 0, 2, "wall", "storage", "#7b6657", True, True, 0.58, True),
        FurnitureRule("display", "展示柜", 10, 0.90, 0.38, 0, 0, 2, "wall", "storage", "#65736b", True, True, 0.68, True),
        FurnitureRule("console", "玄关 / 沙发边柜", 11, 1.20, 0.35, 0, 0, 1, "wall", "storage", "#927a69", True, False, 0.56, True),
        FurnitureRule("floorLamp", "落地灯", 12, 0.36, 0.36, 0, 0, 2, "corner", "decor", "#c5a968"),
        FurnitureRule("plant", "绿植", 13, 0.42, 0.42, 0, 0, 3, "corner", "decor", "#5f8b68"),
        FurnitureRule("infillCabinet", "拓展填缝定制柜", 14, 2.40, 0.40, 1, 0, 2, "wall", "storage", "#526f68", True, True, 0.62, True, infill_min=1.10, infill_max=5.60),
    )


PROGRAM_RULES = {"bedroom": bedroom_rules, "living": living_rules}


def build_furniture_slots(
    program: str,
    overrides: Mapping[str, Mapping[str, Any]] | None,
    use_size_variants: bool,
) -> list[FurnitureSlot]:
    """把前端式配置编译成按落子顺序排列的 min–max 槽位。"""
    if program not in PROGRAM_RULES:
        raise ValueError(f"unknown program: {program!r}")
    overrides = overrides or {}
    slots: list[FurnitureSlot] = []
    for rule in sorted(PROGRAM_RULES[program](), key=lambda row: row.order):
        patch = overrides.get(rule.type_id, {})
        effective_rule = replace(rule, shape=str(patch.get("shape", rule.shape)))
        count = int(patch.get("max_count", patch.get("count", rule.default_max_count)))
        count = max(rule.min_count, min(rule.allowed_max_count, count))
        width = float(patch.get("w", patch.get("width", rule.default_w)))
        depth = float(patch.get("d", patch.get("depth", rule.default_d)))
        custom_variants = patch.get("size_variants")
        if custom_variants:
            variants = tuple(SizeVariant(
                str(row.get("id", f"size-{index + 1}")), str(row.get("label", f"规格 {index + 1}")),
                float(row["w"]), float(row["d"]),
            ) for index, row in enumerate(custom_variants))
        else:
            variants = effective_rule.size_variants if use_size_variants and not patch.get("fixed_size", False) else ()
        for index in range(count):
            slot_id = rule.type_id if index == 0 else f"{rule.type_id}{index + 1}"
            slots.append(FurnitureSlot(
                id=slot_id,
                type_id=rule.type_id,
                label=rule.label,
                w=width,
                d=depth,
                optional=index >= rule.min_count,
                slot_index=index,
                rule=effective_rule,
                size_variants=variants,
            ))
    return slots


# ---------------------------------------------------------------------------
# 3. 多边形与 NumPy Bitset 编译
# ---------------------------------------------------------------------------


def polygon_area(polygon: Sequence[tuple[float, float]]) -> float:
    points = np.asarray(polygon, dtype=np.float64)
    shifted = np.roll(points, -1, axis=0)
    return abs(float(np.sum(points[:, 0] * shifted[:, 1] - shifted[:, 0] * points[:, 1]))) / 2


def point_in_polygon(point: tuple[float, float], polygon: Sequence[tuple[float, float]]) -> bool:
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and x < (xj - xi) * (y - yi) / ((yj - yi) or EPS) + xi:
            inside = not inside
        j = i
    return inside


def points_in_polygon(xs: np.ndarray, ys: np.ndarray, polygon: Sequence[tuple[float, float]]) -> np.ndarray:
    inside = np.zeros(xs.shape, dtype=bool)
    xj, yj = polygon[-1]
    for xi, yi in polygon:
        crosses = (yi > ys) != (yj > ys)
        boundary_x = (xj - xi) * (ys - yi) / ((yj - yi) if abs(yj - yi) > EPS else EPS) + xi
        inside ^= crosses & (xs < boundary_x)
        xj, yj = xi, yi
    return inside


def bool_mask_to_words(mask: np.ndarray) -> np.ndarray:
    flat = np.asarray(mask, dtype=np.uint8).reshape(-1)
    pad = (-flat.size) % 64
    if pad:
        flat = np.pad(flat, (0, pad))
    return np.packbits(flat, bitorder="little").view(np.uint64)


def words_to_bool(words: np.ndarray, count: int, shape: tuple[int, int]) -> np.ndarray:
    bits = np.unpackbits(words.view(np.uint8), bitorder="little")[:count]
    return bits.astype(bool, copy=False).reshape(shape)


def words_overlap(left: np.ndarray, right: np.ndarray) -> bool:
    return bool(np.bitwise_and(left, right).any())


def rect_mask(rect: Rect, grid: GridContext) -> np.ndarray:
    return (grid.xs >= rect.x0) & (grid.xs < rect.x1) & (grid.ys >= rect.y0) & (grid.ys < rect.y1)


def rects_mask(rects: Iterable[Rect], grid: GridContext) -> np.ndarray:
    mask = np.zeros((grid.rows, grid.cols), dtype=bool)
    for rect in rects:
        mask |= rect_mask(rect, grid)
    return mask


def compile_walls(room: RoomInput) -> tuple[Wall, ...]:
    walls: list[Wall] = []
    polygon = room.polygon
    for index, a in enumerate(polygon):
        b = polygon[(index + 1) % len(polygon)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy)
        if length < EPS:
            continue
        direction = (dx / length, dy / length)
        candidates = ((-direction[1], direction[0]), (direction[1], -direction[0]))
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        inward = candidates[0]
        for normal in candidates:
            probe = (mid[0] + normal[0] * 0.04, mid[1] + normal[1] * 0.04)
            if point_in_polygon(probe, polygon):
                inward = normal
                break
        walls.append(Wall(index, a, b, direction, inward, length, abs(dy) < 1e-6))
    return tuple(walls)


def compile_room_grid(room: RoomInput, step: float = 0.12) -> GridContext:
    """一次性把任意房间轮廓编译为 NumPy 网格和 uint64 Bitset。"""
    polygon = np.asarray(room.polygon, dtype=np.float64)
    min_x, min_y = np.min(polygon, axis=0)
    max_x, max_y = np.max(polygon, axis=0)
    cols = max(1, math.ceil((max_x - min_x) / step))
    rows = max(1, math.ceil((max_y - min_y) / step))
    x_centers = min_x + (np.arange(cols) + 0.5) * step
    y_centers = min_y + (np.arange(rows) + 0.5) * step
    xs, ys = np.meshgrid(x_centers, y_centers)
    room_cells = points_in_polygon(xs, ys, room.polygon)
    door = room.door_no_go
    door_cells = (xs >= door.x0) & (xs < door.x1) & (ys >= door.y0) & (ys < door.y1)
    return GridContext(
        room=room,
        step=step,
        min_x=float(min_x),
        min_y=float(min_y),
        cols=cols,
        rows=rows,
        xs=xs,
        ys=ys,
        room_cells=room_cells,
        door_cells=door_cells,
        room_words=bool_mask_to_words(room_cells),
        door_words=bool_mask_to_words(door_cells),
        walls=compile_walls(room),
    )


# ---------------------------------------------------------------------------
# 4. 家具几何、候选点和栅格化
# ---------------------------------------------------------------------------


def dot(a: tuple[float, float], b: tuple[float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1]


def add(point: tuple[float, float], vector: tuple[float, float], scale: float) -> tuple[float, float]:
    return point[0] + vector[0] * scale, point[1] + vector[1] * scale


def rects_overlap(a: Rect, b: Rect, clearance: float = 0.0) -> bool:
    return not (
        a.x1 + clearance <= b.x0 or b.x1 + clearance <= a.x0
        or a.y1 + clearance <= b.y0 or b.y1 + clearance <= a.y0
    )


def pose_rects(slot: FurnitureSlot, pose: Pose) -> tuple[Rect, ...]:
    world_w, world_d = (pose.w, pose.d) if pose.rotation % 180 == 0 else (pose.d, pose.w)
    if not slot.rule.shape.startswith("l-"):
        return (Rect(pose.x, pose.y, world_w, world_d),)
    base_depth = min(0.96, max(0.72, pose.d * 0.54))
    extension = pose.d - base_depth
    if extension < 0.12:
        return (Rect(pose.x, pose.y, world_w, world_d),)
    chaise_w = min(1.02, max(0.72, pose.w * 0.34))
    sign = -1 if slot.rule.shape == "l-left" else 1
    lateral = pose.wall_dir
    normal = pose.normal
    first_center = add((pose.x, pose.y), normal, -(pose.d - base_depth) / 2)
    second_center = add(add((pose.x, pose.y), lateral, sign * (pose.w - chaise_w) / 2), normal, base_depth / 2)
    if pose.rotation % 180 == 0:
        return (Rect(*first_center, pose.w, base_depth), Rect(*second_center, chaise_w, extension))
    return (Rect(*first_center, base_depth, pose.w), Rect(*second_center, extension, chaise_w))


def service_rect(slot: FurnitureSlot, pose: Pose) -> Rect | None:
    depth = slot.rule.service_depth
    if depth <= 0:
        return None
    normal = pose.normal
    # pose.w 始终沿家具横向，pose.d 始终沿朝向法线；旋转只改变世界轴。
    body_depth = pose.d
    center = add((pose.x, pose.y), normal, body_depth / 2 + depth / 2 + 0.025)
    if abs(normal[0]) > abs(normal[1]):
        return Rect(*center, depth, pose.w + 0.08)
    return Rect(*center, pose.w + 0.08, depth)


def rectangle_inside_polygon(rect: Rect, polygon: Sequence[tuple[float, float]]) -> bool:
    margin = 1e-5
    corners = (
        (rect.x0 + margin, rect.y0 + margin), (rect.x1 - margin, rect.y0 + margin),
        (rect.x1 - margin, rect.y1 - margin), (rect.x0 + margin, rect.y1 - margin),
        (rect.x, rect.y),
    )
    return all(point_in_polygon(point, polygon) for point in corners)


def pose_profile(slot: FurnitureSlot, pose: Pose, grid: GridContext) -> CandidateProfile | None:
    key = (
        slot.type_id, round(pose.x, 3), round(pose.y, 3), pose.rotation,
        round(pose.w, 3), round(pose.d, 3), slot.rule.shape,
    )
    cached = grid.profile_cache.get(key)
    if cached is not None:
        return cached
    body_rects = pose_rects(slot, pose)
    if not all(rectangle_inside_polygon(rect, grid.room.polygon) for rect in body_rects):
        return None
    if any(rects_overlap(rect, grid.room.door_no_go, 0.01) for rect in body_rects):
        return None
    if slot.rule.avoid_window and any(
        rects_overlap(body, window, 0.01) for body in body_rects for window in grid.room.windows
    ):
        return None
    service = service_rect(slot, pose)
    service_rects: tuple[Rect, ...] = (service,) if service and slot.rule.service_hard else ()
    if any(not rectangle_inside_polygon(rect, grid.room.polygon) for rect in service_rects):
        return None
    if any(rects_overlap(rect, grid.room.door_no_go, 0.0) for rect in service_rects):
        return None
    body_words = bool_mask_to_words(rects_mask(body_rects, grid))
    service_words = bool_mask_to_words(rects_mask(service_rects, grid)) if service_rects else np.zeros_like(body_words)
    profile = CandidateProfile(pose, body_rects, service_rects, body_words, service_words)
    grid.profile_cache[key] = profile
    return profile


def size_choices(slot: FurnitureSlot) -> tuple[SizeVariant, ...]:
    if slot.size_variants:
        return slot.size_variants
    return (SizeVariant("fixed", "固定尺寸", slot.w, slot.d),)


def axis_wall_candidates(slot: FurnitureSlot, grid: GridContext) -> list[Pose]:
    poses: list[Pose] = []
    for variant in size_choices(slot):
        for wall in grid.walls:
            if not (wall.horizontal or abs(wall.direction[0]) < 1e-6):
                continue
            if wall.length < variant.w + 0.08:
                continue
            margin = variant.w / 2 + 0.04
            available = wall.length - margin * 2
            sample_count = max(1, math.ceil(max(0.0, available) / 0.36))
            values = [margin, wall.length - margin, wall.length / 2, wall.length / 3, wall.length * 2 / 3]
            values.extend(margin + available * i / sample_count for i in range(sample_count + 1))
            for t in sorted({round(value, 3) for value in values if margin - EPS <= value <= wall.length - margin + EPS}):
                wall_point = add(wall.a, wall.direction, t)
                center = add(wall_point, wall.inward, variant.d / 2 + 0.025)
                poses.append(Pose(
                    *center,
                    rotation=0 if wall.horizontal else 90,
                    w=variant.w,
                    d=variant.d,
                    relation="wall",
                    wall_index=wall.index,
                    normal=wall.inward,
                    wall_dir=wall.direction,
                    variant_id=variant.id,
                    variant_label=variant.label,
                ))
    return poses


def corner_candidates(slot: FurnitureSlot, grid: GridContext) -> list[Pose]:
    polygon = np.asarray(grid.room.polygon)
    min_x, min_y = np.min(polygon, axis=0)
    max_x, max_y = np.max(polygon, axis=0)
    poses: list[Pose] = []
    for variant in size_choices(slot):
        inset_x, inset_y = variant.w / 2 + 0.16, variant.d / 2 + 0.16
        for x, y in ((min_x + inset_x, min_y + inset_y), (max_x - inset_x, min_y + inset_y),
                     (min_x + inset_x, max_y - inset_y), (max_x - inset_x, max_y - inset_y)):
            center = ((min_x + max_x) / 2, (min_y + max_y) / 2)
            vx, vy = center[0] - x, center[1] - y
            length = math.hypot(vx, vy) or 1
            normal = (vx / length, vy / length)
            poses.append(Pose(x, y, 0, variant.w, variant.d, "corner", -1, normal, (1, 0), variant.id, variant.label))
    return poses


def room_zone_candidates(slot: FurnitureSlot, grid: GridContext) -> list[Pose]:
    polygon = np.asarray(grid.room.polygon)
    min_x, min_y = np.min(polygon, axis=0)
    max_x, max_y = np.max(polygon, axis=0)
    ratios = ((0.30, 0.30), (0.50, 0.30), (0.70, 0.30), (0.30, 0.55), (0.50, 0.55), (0.70, 0.55), (0.30, 0.75), (0.70, 0.75))
    poses: list[Pose] = []
    for variant in size_choices(slot):
        for rotation in (0, 90):
            normal = (0.0, 1.0) if rotation == 0 else (1.0, 0.0)
            wall_dir = (1.0, 0.0) if rotation == 0 else (0.0, 1.0)
            for rx, ry in ratios:
                poses.append(Pose(
                    min_x + (max_x - min_x) * rx, min_y + (max_y - min_y) * ry,
                    rotation, variant.w, variant.d, "zone", -1, normal, wall_dir,
                    variant.id, variant.label,
                ))
    return poses


def placed_by_type(state: SearchState, slots_by_id: Mapping[str, FurnitureSlot], type_id: str) -> list[tuple[FurnitureSlot, Pose]]:
    return [(slots_by_id[item_id], pose) for item_id, pose in state.poses.items() if slots_by_id[item_id].type_id == type_id]


def relation_candidates(
    slot: FurnitureSlot,
    state: SearchState,
    grid: GridContext,
    slots_by_id: Mapping[str, FurnitureSlot],
) -> list[Pose]:
    poses: list[Pose] = []
    variants = size_choices(slot)

    if slot.type_id == "night":
        for bed_slot, bed in placed_by_type(state, slots_by_id, "bed"):
            for variant in variants:
                for side in (-1, 1):
                    lateral = bed.wall_dir
                    offset = bed.w / 2 + variant.w / 2
                    center = add(add((bed.x, bed.y), lateral, side * offset), bed.normal, -(bed.d / 2) + variant.d / 2)
                    poses.append(Pose(*center, bed.rotation, variant.w, variant.d, "bed-side", bed.wall_index, bed.normal, lateral, variant.id, variant.label, bed_slot.id))
        return poses

    if slot.type_id in {"chair", "vanityStool"}:
        target_type = "desk" if slot.type_id == "chair" else "vanity"
        relation = "desk-front" if slot.type_id == "chair" else "vanity-seat"
        for target_slot, target in placed_by_type(state, slots_by_id, target_type):
            for variant in variants:
                for offset in (-0.20, 0.0, 0.20):
                    center = add((target.x, target.y), target.normal, target.d / 2 + variant.d / 2 + 0.28)
                    center = add(center, target.wall_dir, offset)
                    poses.append(Pose(*center, target.rotation, variant.w, variant.d, relation, -1, (-target.normal[0], -target.normal[1]), target.wall_dir, variant.id, variant.label, target_slot.id))
        return poses

    if slot.type_id == "bench":
        for bed_slot, bed in placed_by_type(state, slots_by_id, "bed"):
            for variant in variants:
                center = add((bed.x, bed.y), bed.normal, bed.d / 2 + variant.d / 2 + 0.34)
                poses.append(Pose(*center, bed.rotation, variant.w, variant.d, "bed-foot", -1, bed.normal, bed.wall_dir, variant.id, variant.label, bed_slot.id))
        return poses

    sofas = placed_by_type(state, slots_by_id, "sofa")
    if not sofas:
        return poses
    sofa_slot, sofa = sofas[0]
    lateral, normal = sofa.wall_dir, sofa.normal

    if slot.type_id == "coffee":
        for variant in variants:
            for offset in (-0.20, 0.0, 0.20):
                center = add(add((sofa.x, sofa.y), normal, sofa.d / 2 + variant.d / 2 + 0.42), lateral, offset)
                poses.append(Pose(*center, sofa.rotation, variant.w, variant.d, "sofa-front", -1, normal, lateral, variant.id, variant.label, sofa_slot.id))
    elif slot.type_id == "arm":
        for variant in variants:
            forward = sofa.d / 2 + variant.d / 2 + 0.72
            for side in (-1, 1):
                center = add(add((sofa.x, sofa.y), normal, forward), lateral, side * (sofa.w / 2 + variant.w / 2 + 0.18))
                poses.append(Pose(*center, (sofa.rotation + 90) % 180, variant.w, variant.d, "conversation-side", -1, (-side * lateral[0], -side * lateral[1]), normal, variant.id, variant.label, sofa_slot.id))
            center = add((sofa.x, sofa.y), normal, sofa.d / 2 + variant.d / 2 + 1.05)
            poses.append(Pose(*center, sofa.rotation, variant.w, variant.d, "conversation-opposite", -1, (-normal[0], -normal[1]), lateral, variant.id, variant.label, sofa_slot.id))
    elif slot.type_id in {"side", "floorLamp"}:
        for variant in variants:
            for side in (-1, 1):
                center = add((sofa.x, sofa.y), lateral, side * (sofa.w / 2 + variant.w / 2 + 0.12))
                poses.append(Pose(*center, sofa.rotation, variant.w, variant.d, "sofa-side", -1, normal, lateral, variant.id, variant.label, sofa_slot.id))
    elif slot.type_id == "ottoman":
        for variant in variants:
            center = add((sofa.x, sofa.y), normal, sofa.d / 2 + variant.d / 2 + 0.46)
            poses.append(Pose(*center, sofa.rotation, variant.w, variant.d, "sofa-ottoman", -1, normal, lateral, variant.id, variant.label, sofa_slot.id))
    return poses


def dining_chair_candidates(
    slot: FurnitureSlot,
    state: SearchState,
    slots_by_id: Mapping[str, FurnitureSlot],
) -> list[Pose]:
    poses: list[Pose] = []
    for table_slot, table in placed_by_type(state, slots_by_id, "diningTable"):
        for variant in size_choices(slot):
            side_distance = table.d / 2 + variant.d / 2 + 0.24
            for side in (-1, 1):
                for offset in (-table.w * 0.25, table.w * 0.25):
                    center = add(add((table.x, table.y), table.normal, side * side_distance), table.wall_dir, offset)
                    poses.append(Pose(*center, table.rotation, variant.w, variant.d, "dining-seat", -1, (-side * table.normal[0], -side * table.normal[1]), table.wall_dir, variant.id, variant.label, table_slot.id))
            end_distance = table.w / 2 + variant.d / 2 + 0.24
            for side in (-1, 1):
                center = add((table.x, table.y), table.wall_dir, side * end_distance)
                poses.append(Pose(*center, (table.rotation + 90) % 180, variant.w, variant.d, "dining-seat", -1, (-side * table.wall_dir[0], -side * table.wall_dir[1]), table.normal, variant.id, variant.label, table_slot.id))
    return poses


def living_tv_candidates(
    slot: FurnitureSlot,
    state: SearchState,
    grid: GridContext,
    slots_by_id: Mapping[str, FurnitureSlot],
) -> list[Pose]:
    sofas = placed_by_type(state, slots_by_id, "sofa")
    wall_poses = axis_wall_candidates(slot, grid)
    if not sofas:
        return wall_poses
    sofa_slot, sofa = sofas[0]
    facing: list[Pose] = []
    for pose in wall_poses:
        vx, vy = sofa.x - pose.x, sofa.y - pose.y
        distance = math.hypot(vx, vy)
        if distance < 1.25:
            continue
        direction = (vx / distance, vy / distance)
        looks_at_sofa = dot(pose.normal, direction)
        sofa_to_tv = (-direction[0], -direction[1])
        sofa_looks_back = dot(sofa.normal, sofa_to_tv)
        lateral_offset = abs(dot((sofa.x - pose.x, sofa.y - pose.y), pose.wall_dir))
        if looks_at_sofa >= 0.72 and sofa_looks_back >= 0.72 and lateral_offset <= max(0.90, sofa.w * 0.58):
            facing.append(replace(pose, relation="sofa-facing", relation_target=sofa_slot.id))
    return facing or wall_poses


def subtract_interval(intervals: list[tuple[float, float]], cut0: float, cut1: float) -> list[tuple[float, float]]:
    result: list[tuple[float, float]] = []
    for start, end in intervals:
        if cut1 <= start or cut0 >= end:
            result.append((start, end))
        else:
            if cut0 > start + 0.04:
                result.append((start, min(end, cut0)))
            if cut1 < end - 0.04:
                result.append((max(start, cut1), end))
    return result


def custom_infill_candidates(
    slot: FurnitureSlot,
    state: SearchState,
    grid: GridContext,
    slots_by_id: Mapping[str, FurnitureSlot],
) -> list[Pose]:
    poses: list[Pose] = []
    minimum = slot.rule.infill_min or 1.10
    maximum = slot.rule.infill_max or 5.60
    for wall in grid.walls:
        if not (wall.horizontal or abs(wall.direction[0]) < 1e-6):
            continue
        intervals = [(0.04, wall.length - 0.04)]
        for item_id, pose in state.poses.items():
            if pose.wall_index != wall.index:
                continue
            along = dot((pose.x - wall.a[0], pose.y - wall.a[1]), wall.direction)
            intervals = subtract_interval(intervals, along - pose.w / 2 - 0.03, along + pose.w / 2 + 0.03)
        for window in grid.room.windows:
            corners = ((window.x0, window.y0), (window.x1, window.y1))
            if min(math.dist(corner, wall.a) + math.dist(corner, wall.b) - wall.length for corner in corners) < 0.10:
                values = [dot((corner[0] - wall.a[0], corner[1] - wall.a[1]), wall.direction) for corner in corners]
                intervals = subtract_interval(intervals, min(values) - 0.05, max(values) + 0.05)
        for start, end in intervals:
            available = end - start
            if available < minimum + 0.02:
                continue
            width = min(maximum, math.floor((available - 0.01) / 0.05) * 0.05)
            if width < minimum:
                continue
            centers = (start + width / 2, end - width / 2) if available > maximum + 0.12 else ((start + end) / 2,)
            for t in sorted({round(value, 3) for value in centers}):
                wall_point = add(wall.a, wall.direction, t)
                center = add(wall_point, wall.inward, slot.d / 2 + 0.025)
                poses.append(Pose(*center, 0 if wall.horizontal else 90, width, slot.d, "custom-infill", wall.index, wall.inward, wall.direction, "infill", f"定制 {width:.2f}m"))
    return poses


def generate_raw_poses(
    slot: FurnitureSlot,
    state: SearchState,
    grid: GridContext,
    slots_by_id: Mapping[str, FurnitureSlot],
) -> list[Pose]:
    """按家具规则生成候选坐标；这里不做碰撞，便于独立观察候选域。"""
    if slot.type_id == "infillCabinet":
        poses = custom_infill_candidates(slot, state, grid, slots_by_id)
    elif slot.type_id == "tv":
        poses = living_tv_candidates(slot, state, grid, slots_by_id)
    elif slot.type_id == "diningChair":
        poses = dining_chair_candidates(slot, state, slots_by_id)
    elif slot.rule.anchor == "relation":
        poses = relation_candidates(slot, state, grid, slots_by_id)
    elif slot.rule.anchor == "corner":
        poses = corner_candidates(slot, grid)
        if slot.type_id == "floorLamp":
            poses = relation_candidates(slot, state, grid, slots_by_id) + poses
    elif slot.rule.anchor == "zone":
        poses = room_zone_candidates(slot, grid)
    else:
        poses = axis_wall_candidates(slot, grid)
    unique: dict[tuple[Any, ...], Pose] = {}
    for pose in poses:
        key = (round(pose.x, 3), round(pose.y, 3), pose.rotation, round(pose.w, 2), round(pose.d, 2), pose.relation, pose.relation_target)
        unique[key] = pose
    return list(unique.values())


# ---------------------------------------------------------------------------
# 5. 批量 Bitset 合法性与局部评分
# ---------------------------------------------------------------------------


TYPE_UTILITY = {
    "bed": 18, "wardrobe": 16, "night": 7, "desk": 11, "chair": 4,
    "vanity": 9, "vanityStool": 3, "bench": 5, "chest": 7, "shelf": 6,
    "tvbench": 5, "lounge": 6, "hamper": 3,
    "sofa": 18, "tv": 14, "coffee": 10, "diningTable": 11,
    "diningChair": 4, "arm": 9, "side": 5, "ottoman": 5,
    "sideboard": 12, "bookcase": 8, "display": 7, "console": 7,
    "floorLamp": 3, "plant": 2.5, "infillCabinet": 17,
}


def candidate_local_score(
    slot: FurnitureSlot,
    pose: Pose,
    state: SearchState,
    grid: GridContext,
    program: str,
) -> float:
    score = 14.0 if pose.wall_index >= 0 else 10.0
    relation_bonus = {
        "bed-side": 48, "desk-front": 42, "vanity-seat": 42, "bed-foot": 40,
        "sofa-front": 48, "conversation-side": 40, "conversation-opposite": 38,
        "sofa-facing": 54,
        "sofa-side": 36, "sofa-ottoman": 32, "dining-seat": 42,
        "zone": 20, "corner": 18, "custom-infill": 42,
    }
    score += relation_bonus.get(pose.relation, 0)
    distance_from_entry = math.dist((pose.x, pose.y), grid.room.entry_point)
    if slot.type_id in {"bed", "sofa"}:
        score += min(10.0, distance_from_entry * 2)
    if slot.type_id == "bed":
        area = polygon_area(grid.room.polygon)
        bed_slots = sum(1 for item in state.poses if item.startswith("bed")) + 1
        target = 1.20 if bed_slots >= 2 else 1.80 if area >= 18 else 1.50 if area >= 11 else 1.20
        score += 16 - abs(pose.w - target) * 24
    if slot.type_id == "night":
        target = 0.55 if polygon_area(grid.room.polygon) > 18 else 0.45
        score += 7 - abs(pose.w - target) * 22
    if slot.type_id == "tv":
        sofas = [p for item_id, p in state.poses.items() if item_id.startswith("sofa")]
        if sofas:
            sofa = sofas[0]
            score += max(-8, 24 - abs(math.dist((pose.x, pose.y), (sofa.x, sofa.y)) - 2.7) * 10)
    if slot.type_id == "infillCabinet":
        score += min(32, pose.w * 7)
    occupied_area = sum(p.w * p.d for p in state.poses.values())
    projected_density = (occupied_area + pose.w * pose.d) / max(polygon_area(grid.room.polygon), EPS)
    target_density = 0.21 if program == "living" else 0.24
    score -= max(0.0, projected_density - target_density) * 150
    return float(score)


def optional_skip_score(
    slot: FurnitureSlot,
    state: SearchState,
    top_place_score: float,
    room_area: float,
    program: str,
) -> float:
    occupied = sum(pose.w * pose.d for pose in state.poses.values()) / max(room_area, EPS)
    target = 0.16 if program == "living" else 0.21
    cost = np.clip(5 + TYPE_UTILITY.get(slot.type_id, 5) * 0.16 - (occupied - target) * 92, -14, 9)
    return float(top_place_score - cost)


def batch_legal_candidates(
    slot: FurnitureSlot,
    state: SearchState,
    grid: GridContext,
    slots_by_id: Mapping[str, FurnitureSlot],
    program: str,
    limit: int,
) -> tuple[list[tuple[CandidateProfile | None, float, bool]], int]:
    """NumPy 一次计算当前父局面的所有候选碰撞，而不是逐个 Python 判断。"""
    profiles = [
        profile for pose in generate_raw_poses(slot, state, grid, slots_by_id)
        if (profile := pose_profile(slot, pose, grid)) is not None
    ]
    if profiles:
        bodies = np.stack([profile.body_words for profile in profiles])
        services = np.stack([profile.service_words for profile in profiles])
        body_collision = np.bitwise_and(bodies, state.occupancy).any(axis=1)
        body_hits_service = np.bitwise_and(bodies, state.hard_service).any(axis=1)
        service_hits_body = np.bitwise_and(services, state.occupancy).any(axis=1)
        legal_mask = ~(body_collision | body_hits_service | service_hits_body)
        legal_profiles = [profile for profile, legal in zip(profiles, legal_mask, strict=True) if legal]
    else:
        legal_profiles = []
    scored = [
        (profile, candidate_local_score(slot, profile.pose, state, grid, program), False)
        for profile in legal_profiles
    ]
    scored.sort(key=lambda row: row[1], reverse=True)
    if slot.optional:
        top = scored[0][1] if scored else 18.0
        scored.append((None, optional_skip_score(slot, state, top, polygon_area(grid.room.polygon), program), True))
        scored.sort(key=lambda row: row[1], reverse=True)
    return scored[:limit], len(profiles)


# ---------------------------------------------------------------------------
# 6. Beam Search、数量适配和同构去重
# ---------------------------------------------------------------------------


def canonical_state_key(state: SearchState, slots_by_id: Mapping[str, FurnitureSlot]) -> tuple[Any, ...]:
    groups: dict[str, list[tuple[Any, ...]]] = {}
    for item_id, pose in state.poses.items():
        type_id = slots_by_id[item_id].type_id
        groups.setdefault(type_id, []).append((
            round(pose.x, 2), round(pose.y, 2), pose.rotation,
            round(pose.w, 2), round(pose.d, 2), pose.variant_id,
        ))
    return tuple((type_id, tuple(sorted(values))) for type_id, values in sorted(groups.items()))


def select_quantity_diverse(states: list[SearchState], limit: int) -> list[SearchState]:
    if len(states) <= limit:
        return states
    representatives: dict[int, SearchState] = {}
    for state in states:
        representatives.setdefault(len(state.poses), state)
    selected = list(representatives.values())
    selected_ids = {id(state) for state in selected}
    for state in states:
        if len(selected) >= limit:
            break
        if id(state) not in selected_ids:
            selected.append(state)
            selected_ids.add(id(state))
    return sorted(selected, key=lambda row: row.partial_score, reverse=True)


def beam_search_layouts(
    room: RoomInput,
    program: str,
    slots: Sequence[FurnitureSlot],
    config: SearchConfig,
) -> tuple[list[SearchState], SearchStats, GridContext]:
    """主搜索：候选生成 → NumPy Bitset 批检 → 同构去重 → 数量多样 Beam。"""
    started = time.perf_counter()
    grid = compile_room_grid(room, config.grid_step)
    slots_by_id = {slot.id: slot for slot in slots}
    empty_words = np.zeros_like(grid.room_words)
    beam = [SearchState({}, empty_words, empty_words, 0.0)]
    expanded = legal_total = duplicate_total = 0

    for depth, slot in enumerate(slots, start=1):
        children: dict[tuple[Any, ...], SearchState] = {}
        for parent in beam:
            candidates, raw_count = batch_legal_candidates(
                slot, parent, grid, slots_by_id, program, config.candidates_per_parent
            )
            expanded += raw_count + int(slot.optional)
            for profile, merit, skipped in candidates:
                legal_total += 1
                if skipped:
                    poses = dict(parent.poses)
                    occupancy = parent.occupancy
                    hard_service = parent.hard_service
                    action = {"depth": depth, "slot": slot.id, "type": slot.type_id, "action": "skip", "actual_increment": 0}
                else:
                    assert profile is not None
                    poses = {**parent.poses, slot.id: profile.pose}
                    occupancy = np.bitwise_or(parent.occupancy, profile.body_words)
                    hard_service = np.bitwise_or(parent.hard_service, profile.service_words)
                    action = {
                        "depth": depth, "slot": slot.id, "type": slot.type_id,
                        "action": "place", "variant": profile.pose.variant_label,
                        "x": round(profile.pose.x, 3), "y": round(profile.pose.y, 3),
                        "rotation": profile.pose.rotation,
                    }
                child = SearchState(poses, occupancy, hard_service, parent.partial_score + merit, parent.path + (action,))
                key = canonical_state_key(child, slots_by_id)
                prior = children.get(key)
                if prior is None or child.partial_score > prior.partial_score:
                    if prior is not None:
                        duplicate_total += 1
                    children[key] = child
                else:
                    duplicate_total += 1
        ranked = sorted(children.values(), key=lambda row: row.partial_score, reverse=True)
        if config.keep_quantity_diversity:
            beam = select_quantity_diverse(ranked, config.beam_width)
        else:
            beam = ranked[: config.beam_width]
        if not beam:
            break

    elapsed_ms = (time.perf_counter() - started) * 1000
    stats = SearchStats(
        program=program,
        grid=(grid.rows, grid.cols),
        slots=len(slots),
        expanded=expanded,
        legal_candidates=legal_total,
        duplicate_states=duplicate_total,
        elapsed_ms=elapsed_ms,
        final_beam=len(beam),
        output_count=0,
    )
    return beam, stats, grid


# ---------------------------------------------------------------------------
# 7. 最终通行、评分和方案列表
# ---------------------------------------------------------------------------


def nearest_free_cell(point: tuple[float, float], free: np.ndarray, grid: GridContext) -> tuple[int, int] | None:
    col = int((point[0] - grid.min_x) / grid.step)
    row = int((point[1] - grid.min_y) / grid.step)
    col = min(grid.cols - 1, max(0, col))
    row = min(grid.rows - 1, max(0, row))
    if free[row, col]:
        return row, col
    ys, xs = np.where(free)
    if not len(xs):
        return None
    index = int(np.argmin((xs - col) ** 2 + (ys - row) ** 2))
    return int(ys[index]), int(xs[index])


def flood_reachable(free: np.ndarray, start: tuple[int, int] | None) -> np.ndarray:
    reached = np.zeros_like(free)
    if start is None:
        return reached
    queue: deque[tuple[int, int]] = deque([start])
    reached[start] = True
    rows, cols = free.shape
    while queue:
        row, col = queue.popleft()
        for nr, nc in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)):
            if 0 <= nr < rows and 0 <= nc < cols and free[nr, nc] and not reached[nr, nc]:
                reached[nr, nc] = True
                queue.append((nr, nc))
    return reached


def evaluate_circulation(
    state: SearchState,
    slots_by_id: Mapping[str, FurnitureSlot],
    grid: GridContext,
) -> tuple[float, float, bool]:
    occupancy = words_to_bool(state.occupancy, grid.cell_count, (grid.rows, grid.cols))
    free = grid.room_cells & ~grid.door_cells & ~occupancy
    reached = flood_reachable(free, nearest_free_cell(grid.room.entry_point, free, grid))
    free_count = int(free.sum())
    connected_ratio = float(reached.sum() / free_count) if free_count else 0.0
    targets = []
    required_targets = []
    for item_id, pose in state.poses.items():
        slot = slots_by_id[item_id]
        if not slot.rule.access_target:
            continue
        service = service_rect(slot, pose)
        if service is None:
            continue
        hit = bool((rect_mask(service, grid) & reached).any())
        targets.append(hit)
        if not slot.optional:
            required_targets.append(hit)
    access_ratio = sum(targets) / len(targets) if targets else 1.0
    required_pass = all(required_targets) if required_targets else True
    score = 100 * (connected_ratio * 0.56 + access_ratio * 0.44)
    return score, connected_ratio, required_pass


def relation_satisfied(slot: FurnitureSlot, pose: Pose) -> bool:
    if slot.type_id in {"night", "chair", "vanityStool", "bench", "coffee", "diningChair", "arm", "side", "ottoman"}:
        return bool(pose.relation and pose.relation not in {"wall", "zone", "corner"})
    if slot.type_id == "diningTable":
        return pose.relation == "zone"
    return pose.wall_index >= 0 or pose.relation == "corner"


def evaluate_layout(
    state: SearchState,
    slots: Sequence[FurnitureSlot],
    grid: GridContext,
    program: str,
) -> Evaluation:
    slots_by_id = {slot.id: slot for slot in slots}
    required_ok = all(slot.optional or slot.id in state.poses for slot in slots)
    circulation, connected_ratio, access_ok = evaluate_circulation(state, slots_by_id, grid)
    actual_count = len(state.poses)
    area = polygon_area(grid.room.polygon)
    furniture_area = sum(pose.w * pose.d for pose in state.poses.values())
    density = furniture_area / max(area, EPS)
    target_density = 0.27 if program == "living" else 0.34
    density_score = max(0.0, 100 - abs(density - target_density) * 430)

    placed_slots = [slots_by_id[item_id] for item_id in state.poses]
    relation = 100 * sum(relation_satisfied(slot, state.poses[slot.id]) for slot in placed_slots) / max(1, len(placed_slots))
    required_types = {slot.type_id for slot in slots if not slot.optional}
    placed_types = {slot.type_id for slot in placed_slots}
    core_coverage = len(required_types & placed_types) / max(1, len(required_types))
    utility = sum(TYPE_UTILITY.get(slot.type_id, 4) for slot in placed_slots)
    utility_target = 62 if program == "living" else 50
    function = 100 * (core_coverage * 0.64 + min(1.0, utility / utility_target) * 0.36)

    storage_width = sum(
        state.poses[slot.id].w for slot in placed_slots
        if slot.rule.category == "storage" and state.poses[slot.id].wall_index >= 0
    )
    wall_length = sum(wall.length for wall in grid.walls if wall.horizontal or abs(wall.direction[0]) < 1e-6)
    storage = min(100.0, 28 + storage_width / max(wall_length * 0.28, 0.5) * 72)

    if state.poses:
        centers = np.array([(pose.x, pose.y) for pose in state.poses.values()])
        mass_center = centers.mean(axis=0)
        polygon_points = np.asarray(grid.room.polygon)
        room_center = polygon_points.mean(axis=0)
        diagonal = math.hypot(np.ptp(polygon_points[:, 0]), np.ptp(polygon_points[:, 1])) or 1
        balance = max(0.0, 1 - np.linalg.norm(mass_center - room_center) / (diagonal * 0.35))
    else:
        balance = 0.0
    composition = 100 * (balance * 0.46 + density_score / 100 * 0.36 + connected_ratio * 0.18)
    comfort = min(100.0, circulation * 0.82 + relation * 0.18)

    window_center = None
    if grid.room.windows:
        window_center = (grid.room.windows[0].x, grid.room.windows[0].y)
    daylight_values = []
    for item_id, pose in state.poses.items():
        slot = slots_by_id[item_id]
        if slot.type_id in {"desk", "vanity"} and window_center:
            daylight_values.append(max(0.0, 1 - math.dist((pose.x, pose.y), window_center) / 2.5))
        if slot.rule.avoid_window:
            daylight_values.append(1.0)
    daylight = 100 * (sum(daylight_values) / len(daylight_values) if daylight_values else 0.72)
    feasible = 100.0 if required_ok and access_ok else 0.0
    hard_pass = required_ok and access_ok and circulation >= 42

    total = (
        function * 0.15 + circulation * 0.20 + relation * 0.20 + composition * 0.20
        + storage * 0.10 + comfort * 0.10 + daylight * 0.05
    )
    if not hard_pass:
        total *= 0.55
    return Evaluation(
        round(total, 2), round(feasible, 2), round(function, 2), round(circulation, 2),
        round(relation, 2), round(composition, 2), round(storage, 2), round(comfort, 2),
        round(daylight, 2), hard_pass, actual_count, round(density, 4),
    )


def layout_distance(left: SearchState, right: SearchState, slots_by_id: Mapping[str, FurnitureSlot]) -> float:
    left_groups: dict[str, list[Pose]] = {}
    right_groups: dict[str, list[Pose]] = {}
    for item_id, pose in left.poses.items():
        left_groups.setdefault(slots_by_id[item_id].type_id, []).append(pose)
    for item_id, pose in right.poses.items():
        right_groups.setdefault(slots_by_id[item_id].type_id, []).append(pose)
    total = 0.0
    for type_id in set(left_groups) | set(right_groups):
        a = sorted(left_groups.get(type_id, []), key=lambda p: (p.x, p.y, p.w, p.d))
        b = sorted(right_groups.get(type_id, []), key=lambda p: (p.x, p.y, p.w, p.d))
        if len(a) != len(b):
            total += abs(len(a) - len(b)) * 10
            continue
        total += sum(
            math.dist((pa.x, pa.y), (pb.x, pb.y))
            + (0 if pa.rotation == pb.rotation else 1.0)
            + abs(pa.w - pb.w) + abs(pa.d - pb.d)
            for pa, pb in zip(a, b, strict=True)
        )
    return total


def rank_and_dedupe_outputs(
    beam: Sequence[SearchState],
    slots: Sequence[FurnitureSlot],
    grid: GridContext,
    program: str,
    output_limit: int,
) -> list[LayoutResult]:
    slots_by_id = {slot.id: slot for slot in slots}
    evaluated = [(state, evaluate_layout(state, slots, grid, program)) for state in beam]
    hard = [(state, score) for state, score in evaluated if score.hard_pass]
    pool = hard if hard else evaluated
    pool.sort(key=lambda row: row[1].total, reverse=True)
    unique: list[tuple[SearchState, Evaluation]] = []
    for state, score in pool:
        if all(layout_distance(state, other, slots_by_id) >= 0.30 for other, _ in unique):
            unique.append((state, score))
        if len(unique) >= output_limit:
            break
    results: list[LayoutResult] = []
    for rank, (state, score) in enumerate(unique, start=1):
        furniture = []
        for item_id, pose in state.poses.items():
            slot = slots_by_id[item_id]
            furniture.append({
                "id": item_id,
                "type": slot.type_id,
                "label": slot.label,
                "variant": pose.variant_label,
                "x": round(pose.x, 3),
                "y": round(pose.y, 3),
                "rotation": pose.rotation,
                "width": round(pose.w, 3),
                "depth": round(pose.d, 3),
                "relation": pose.relation,
                "wall_index": pose.wall_index,
            })
        results.append(LayoutResult(rank, score.total, score, tuple(furniture), state.path))
    return results


def generate_layouts(
    room: RoomInput,
    program: str,
    inventory_overrides: Mapping[str, Mapping[str, Any]] | None = None,
    search_config: SearchConfig | None = None,
) -> tuple[list[LayoutResult], SearchStats]:
    """公开 API：输入轮廓和前端式配置，返回最终总方案列表。"""
    config = search_config or SearchConfig()
    slots = build_furniture_slots(program, inventory_overrides, config.use_size_variants)
    beam, stats, grid = beam_search_layouts(room, program, slots, config)
    outputs = rank_and_dedupe_outputs(beam, slots, grid, program, config.output_limit)
    stats = replace(stats, output_count=len(outputs))
    return outputs, stats


# ---------------------------------------------------------------------------
# 8. main：普通卧室与普通客厅 mock
# ---------------------------------------------------------------------------


def rectangle_room(name: str, width: float, depth: float) -> RoomInput:
    door_width = min(0.90, width * 0.30)
    door_x0 = min(0.22, width * 0.06)
    return RoomInput(
        name=name,
        polygon=((0.0, 0.0), (width, 0.0), (width, depth), (0.0, depth)),
        door_no_go=Rect(door_x0 + door_width / 2, depth - door_width / 2, door_width, door_width),
        entry_point=(door_x0 + door_width / 2, depth - door_width + 0.16),
        windows=(Rect(width * 0.58, 0.03, min(1.45 if name == "bedroom" else 1.80, width * 0.40), 0.06),),
    )


def print_case(title: str, layouts: Sequence[LayoutResult], stats: SearchStats) -> None:
    print(f"\n=== {title} ===")
    print(
        f"grid={stats.grid[1]}x{stats.grid[0]}  slots={stats.slots}  "
        f"expanded={stats.expanded:,}  legal={stats.legal_candidates:,}  "
        f"time={stats.elapsed_ms:.1f}ms  outputs={stats.output_count}"
    )
    for layout in layouts[:3]:
        names = ", ".join(f"{item['label']}[{item['variant']}]" for item in layout.furniture)
        print(f"#{layout.rank} score={layout.score:.2f} actual={layout.evaluation.actual_count} | {names}")
    if layouts:
        print("best_json=")
        print(json.dumps(layouts[0].to_dict(), ensure_ascii=False, indent=2))


def result_payload(layouts: Sequence[LayoutResult], stats: SearchStats) -> dict[str, Any]:
    """把 generate_layouts 的返回值转换成可直接传输/落盘的 JSON 对象。"""
    return {
        "stats": asdict(stats),
        "layouts": [layout.to_dict() for layout in layouts],
    }


def main() -> dict[str, Any]:
    config = SearchConfig(grid_step=0.12, beam_width=88, candidates_per_parent=44, output_limit=8)

    bedroom = rectangle_room("bedroom", 3.60, 3.80)
    bedroom_inventory = {
        "bed": {"max_count": 2},            # 1–2，上限 2；自动试三种床规格
        "wardrobe": {"max_count": 1},
        "night": {"max_count": 2},          # 0–2
        "desk": {"max_count": 1},
        "chair": {"max_count": 1},
        "chest": {"max_count": 1},
    }
    bedroom_layouts, bedroom_stats = generate_layouts(
        bedroom, "bedroom", bedroom_inventory, config
    )
    print_case("常规卧室 3.60 x 3.80 m", bedroom_layouts, bedroom_stats)

    living = rectangle_room("living", 4.80, 4.20)
    living_inventory = {
        "sofa": {"max_count": 1},
        "tv": {"max_count": 1},
        "coffee": {"max_count": 1},
        "arm": {"max_count": 2},
        "side": {"max_count": 1},
        "sideboard": {"max_count": 1},
        "plant": {"max_count": 1},
        "infillCabinet": {"max_count": 1},  # 最后一手按剩余墙段定尺
    }
    living_layouts, living_stats = generate_layouts(
        living, "living", living_inventory, config
    )
    print_case("常规客厅 4.80 x 4.20 m", living_layouts, living_stats)

    # main 的最终返回结果：既打印到控制台，也保存为标准 UTF-8 JSON。
    final_result = {
        "bedroom": result_payload(bedroom_layouts, bedroom_stats),
        "living": result_payload(living_layouts, living_stats),
    }
    output_path = Path(__file__).with_name("space_chess_results.json")
    output_path.write_text(json.dumps(final_result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n=== FINAL_RESULT ===")
    print(json.dumps(final_result, ensure_ascii=False, indent=2))
    print(f"\n完整结果已写入：{output_path}")
    return final_result


if __name__ == "__main__":
    main()
