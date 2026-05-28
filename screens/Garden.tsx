import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Dimensions,
} from "react-native";
import {
  GardenState, PLANT_BY_ID, PLOT_COUNT, Plot,
  unlockedPlants, nextLockedPlant, isPlotEmpty, isBloomed,
  plantSeed, waterPlot, clearPlot,
} from "./gardenData";

const { width: SW } = Dimensions.get("window");
const COLS = 3;
const PLOT_GAP = 10;
const BED_PAD = 14;
const PLOT_SIZE = Math.floor((SW - 44 - BED_PAD * 2 - PLOT_GAP * (COLS - 1)) / COLS);

const C = {
  white: "#fbfaf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.48)",
  ghost: "#cdc4b3",
  teal: "#3e9d8f",
  tealSoft: "#d6ebe5",
  crown: "#d9a648",
  soil: "#8a6d4f",
  soilDark: "#6f573e",
  soilSlot: "#7a5f44",
  sky: "#eaf5ee",
  leaf: "#3e9d8f",
};

interface Props {
  crowns: number;
  gardenState: GardenState;
  onSpend: (amount: number) => void;
  onGardenChange: (next: GardenState) => void;
}

export default function Garden({ crowns, gardenState, onSpend, onGardenChange }: Props) {
  const [activePlot, setActivePlot] = useState<number | null>(null);

  // Per-plot pop animation, keyed by index. Triggered when a plant blooms.
  const popAnims = useRef(
    Array.from({ length: PLOT_COUNT }, () => new Animated.Value(1))
  ).current;
  const prevStages = useRef<number[]>(gardenState.plots.map((p) => p.stage));

  useEffect(() => {
    gardenState.plots.forEach((plot, i) => {
      const prev = prevStages.current[i] ?? 0;
      if (plot.plantId && plot.stage > prev) {
        const anim = popAnims[i];
        anim.setValue(plot.stage >= 2 ? 1.5 : 1.25);
        Animated.spring(anim, { toValue: 1, friction: plot.stage >= 2 ? 3 : 4, tension: 300, useNativeDriver: true }).start();
      }
    });
    prevStages.current = gardenState.plots.map((p) => p.stage);
  }, [gardenState]);

  const closeSheet = () => setActivePlot(null);

  const handlePlant = (plantId: string) => {
    if (activePlot === null) return;
    const plant = PLANT_BY_ID[plantId];
    if (!plant || crowns < plant.cost) return;
    const next = plantSeed(gardenState, activePlot, plantId);
    if (!next) return;
    onSpend(plant.cost);
    onGardenChange(next);
    closeSheet();
  };

  const handleWater = () => {
    if (activePlot === null) return;
    const plot = gardenState.plots[activePlot];
    const plant = plot.plantId ? PLANT_BY_ID[plot.plantId] : null;
    if (!plant || crowns < plant.waterCost) return;
    const next = waterPlot(gardenState, activePlot);
    if (!next) return;
    onSpend(plant.waterCost);
    onGardenChange(next);
    closeSheet();
  };

  const handleClear = () => {
    if (activePlot === null) return;
    const next = clearPlot(gardenState, activePlot);
    if (!next) return;
    onGardenChange(next);
    closeSheet();
  };

  const teaser = nextLockedPlant(gardenState.totalBlooms);
  const bloomCount = gardenState.plots.filter(isBloomed).length;

  return (
    <View style={g.wrap}>
      <View style={g.header}>
        <Text style={g.title}>My Garden</Text>
        <Text style={g.sub}>
          {gardenState.totalBlooms > 0
            ? `${gardenState.totalBlooms} bloom${gardenState.totalBlooms === 1 ? "" : "s"} grown`
            : "Clear levels to earn crowns, then plant"}
        </Text>
      </View>

      <View style={g.bed}>
        <View style={g.grid}>
          {gardenState.plots.map((plot, i) => (
            <PlotView
              key={i}
              plot={plot}
              popAnim={popAnims[i]}
              onPress={() => setActivePlot(i)}
            />
          ))}
        </View>
      </View>

      {teaser && (
        <Text style={g.teaser}>
          Next: {teaser.stages[2]} {teaser.name} unlocks at {teaser.unlockAtBlooms} blooms
        </Text>
      )}

      {/* Action sheet */}
      <Modal visible={activePlot !== null} transparent animationType="fade" onRequestClose={closeSheet}>
        <TouchableOpacity style={g.overlay} activeOpacity={1} onPress={closeSheet}>
          <TouchableOpacity style={g.sheet} activeOpacity={1} onPress={() => {}}>
            {activePlot !== null && (
              <SheetContent
                plot={gardenState.plots[activePlot]}
                crowns={crowns}
                totalBlooms={gardenState.totalBlooms}
                onPlant={handlePlant}
                onWater={handleWater}
                onClear={handleClear}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function PlotView({ plot, popAnim, onPress }: { plot: Plot; popAnim: Animated.Value; onPress: () => void }) {
  const empty = isPlotEmpty(plot);
  const plant = plot.plantId ? PLANT_BY_ID[plot.plantId] : null;
  const emoji = plant ? plant.stages[plot.stage] : null;
  const bloomed = isBloomed(plot);

  return (
    <TouchableOpacity
      style={[g.plot, empty && g.plotEmpty, bloomed && g.plotBloomed]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {empty ? (
        <Text style={g.plotPlus}>＋</Text>
      ) : (
        <Animated.Text style={[g.plotEmoji, { transform: [{ scale: popAnim }] }]}>
          {emoji}
        </Animated.Text>
      )}
      {!empty && !bloomed && (
        <View style={g.stageDots}>
          {[0, 1, 2].map((s) => (
            <View key={s} style={[g.dot, plot.stage >= s && g.dotOn]} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function SheetContent({
  plot, crowns, totalBlooms, onPlant, onWater, onClear,
}: {
  plot: Plot;
  crowns: number;
  totalBlooms: number;
  onPlant: (id: string) => void;
  onWater: () => void;
  onClear: () => void;
}) {
  // Empty plot -> plant shop
  if (isPlotEmpty(plot)) {
    const available = unlockedPlants(totalBlooms);
    return (
      <>
        <Text style={g.sheetTitle}>Plant a seed</Text>
        <Text style={g.sheetSub}>♛ {crowns} crowns available</Text>
        <View style={g.shopGrid}>
          {available.map((p) => {
            const afford = crowns >= p.cost;
            return (
              <TouchableOpacity
                key={p.id}
                style={[g.shopItem, !afford && g.shopItemDim]}
                onPress={() => onPlant(p.id)}
                activeOpacity={0.7}
                disabled={!afford}
              >
                <Text style={g.shopEmoji}>{p.stages[2]}</Text>
                <Text style={g.shopName}>{p.name}</Text>
                <Text style={[g.shopCost, !afford && g.shopCostDim]}>♛ {p.cost}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  // Bloomed plot -> info + clear
  const plant = PLANT_BY_ID[plot.plantId!];
  if (isBloomed(plot)) {
    return (
      <>
        <Text style={g.sheetEmojiBig}>{plant.stages[2]}</Text>
        <Text style={g.sheetTitle}>{plant.name} in full bloom</Text>
        <Text style={g.sheetSub}>This plot is thriving.</Text>
        <TouchableOpacity style={g.ghostAction} onPress={onClear} activeOpacity={0.8}>
          <Text style={g.ghostActionText}>Clear plot</Text>
        </TouchableOpacity>
      </>
    );
  }

  // Growing plot -> water action
  const afford = crowns >= plant.waterCost;
  const nextStageLabel = plot.stage === 0 ? "sprout" : "bloom";
  return (
    <>
      <Text style={g.sheetEmojiBig}>{plant.stages[plot.stage]}</Text>
      <Text style={g.sheetTitle}>{plant.name}</Text>
      <Text style={g.sheetSub}>Water it to grow into a {nextStageLabel}.</Text>
      <TouchableOpacity
        style={[g.waterBtn, !afford && g.waterBtnDim]}
        onPress={onWater}
        activeOpacity={0.85}
        disabled={!afford}
      >
        <Text style={g.waterBtnText}>💧 Water  ·  ♛ {plant.waterCost}</Text>
      </TouchableOpacity>
      {!afford && <Text style={g.notEnough}>Not enough crowns — clear a level to earn more.</Text>}
    </>
  );
}

const g = StyleSheet.create({
  wrap: { gap: 10 },
  header: { gap: 3 },
  title: { fontSize: 18, fontWeight: "900", color: C.ink, letterSpacing: -0.4 },
  sub: { fontSize: 12, color: C.inkSoft, fontWeight: "500" },

  bed: {
    backgroundColor: C.soil,
    borderRadius: 20,
    padding: BED_PAD,
    borderWidth: 1,
    borderColor: C.soilDark,
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PLOT_GAP,
    justifyContent: "center",
  },
  plot: {
    width: PLOT_SIZE,
    height: PLOT_SIZE,
    borderRadius: 14,
    backgroundColor: C.soilSlot,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.12)",
  },
  plotEmpty: {
    backgroundColor: "rgba(0,0,0,0.10)",
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.35)",
  },
  plotBloomed: {
    backgroundColor: C.sky,
    borderColor: C.tealSoft,
  },
  plotPlus: { fontSize: 26, color: "rgba(255,255,255,0.55)", fontWeight: "300" },
  plotEmoji: { fontSize: PLOT_SIZE * 0.5 },
  stageDots: {
    position: "absolute",
    bottom: 6,
    flexDirection: "row",
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  dotOn: { backgroundColor: C.leaf },

  teaser: { fontSize: 11, color: C.inkSoft, fontWeight: "500", paddingHorizontal: 2 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(26,29,46,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
    alignItems: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: C.ink, letterSpacing: -0.4, textAlign: "center" },
  sheetSub: { fontSize: 13, color: C.inkSoft, fontWeight: "500", textAlign: "center" },
  sheetEmojiBig: { fontSize: 56 },

  shopGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 4,
  },
  shopItem: {
    width: (SW - 48 - 20) / 3,
    backgroundColor: "#f5efe6",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.07)",
  },
  shopItemDim: { opacity: 0.4 },
  shopEmoji: { fontSize: 30 },
  shopName: { fontSize: 12, fontWeight: "700", color: C.ink },
  shopCost: { fontSize: 12, fontWeight: "800", color: C.crown },
  shopCostDim: { color: C.inkSoft },

  waterBtn: {
    alignSelf: "stretch",
    backgroundColor: C.teal,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  waterBtnDim: { backgroundColor: C.ghost },
  waterBtnText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },
  notEnough: { fontSize: 12, color: C.inkSoft, textAlign: "center" },

  ghostAction: { paddingVertical: 10, paddingHorizontal: 16, marginTop: 2 },
  ghostActionText: { fontSize: 14, fontWeight: "700", color: C.inkSoft },
});
