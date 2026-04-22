import { StyleSheet } from "react-native";
import React from "react";
import { Path, Svg } from "react-native-svg";
import { getTabBarMetrics } from "./tabBarMetrics";

const TabBarSvg = ({ width, height }) => {
  const WIDTH = width;
  const HEIGHT = height;
  const metrics = getTabBarMetrics(WIDTH);
  const centerX = WIDTH / 2;
  const MIDPOIN1X = centerX - metrics.notchHalfWidth;
  const MIDPOIN2X = centerX + metrics.notchHalfWidth;
  const MIDPOINY = metrics.notchDepth;
  const radius = metrics.shoulderRadius;

  const path = `
    M0,0
    L${MIDPOIN1X - radius},${0}
    A${radius},${radius} 0 0,1 ${MIDPOIN1X},${radius}
    A${MIDPOINY},${MIDPOINY} 0 0,0 ${centerX},${MIDPOINY}
    A${MIDPOINY},${MIDPOINY} 0 0,0 ${MIDPOIN2X},${radius}
    A${radius},${radius} 0 0,1 ${MIDPOIN2X + radius},${0}
    L${MIDPOIN2X},${0}
    L${WIDTH},${0}
    L${WIDTH},${height}
    L${0},${height}
    L${0},${0}
    Z
  `;

  return (
    <Svg
      style={{ position: "absolute", bottom: 0 }}
      pointerEvents="none"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {/* White fill — KULA light tab bar */}
      <Path d={path} fill="#FFFFFF" />
      {/* Subtle warm border line at top */}
      <Path
        d={`M0,1 L${MIDPOIN1X - radius},1`}
        stroke="#EDE8DC"
        strokeWidth="1"
        fill="none"
      />
      <Path
        d={`M${MIDPOIN2X + radius},1 L${WIDTH},1`}
        stroke="#EDE8DC"
        strokeWidth="1"
        fill="none"
      />
    </Svg>
  );
};

export default TabBarSvg;

const styles = StyleSheet.create({});
