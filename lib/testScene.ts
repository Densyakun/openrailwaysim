import * as THREE from "three";
import { GameStateType } from './game.js';
import { FeatureCollection } from '@turf/helpers';
import { getProjectedLines } from "./gis.js";
import { createJNR103Series, createTestMalletLocomotive, createTestShikiSeries700, createTestTwoAxlesCar, createTestTwoAxlesCarWithBogies, createTestTwoBogiesCar, createTestTwoBogiesTwoCars, createTestTwoCarsWithJacobsBogies, createUIKeiseiAESeriesMasterControllerConfig, createUISotetsu20000SeriesMasterControllerConfig } from '../lib/trainSamples.js';

export function createTestScene(gameState: GameStateType, featureCollection: FeatureCollection) {
  [featureCollection].forEach((value, index) =>
    gameState.featureCollections[index] = { value }
  );

  // Create projected lines
  /*getProjectedLines(featureCollection).forEach((projectedLine, index) =>
    gameState.projectedLines[index] = projectedLine
  );*/

  // Loop line test
  /*const points = [];
  const radius = 20;
  const pointCount = 64;
  const loopCount = 2;
  const euler = new THREE.Euler(0.5);
  for (let i = 0; i < pointCount * loopCount; i++) {
    points[i] = new THREE.Vector3(
      Math.cos(Math.PI * 2 * i / pointCount) * radius,
      0,
      Math.sin(Math.PI * 2 * i / pointCount) * radius
    ).applyEuler(euler);
  }
  gameState.projectedLines["1"].points = points;*/

  [
    //createUIKeiseiAESeriesMasterControllerConfig(),
    createUISotetsu20000SeriesMasterControllerConfig(),
  ].forEach((uiOneHandleMasterControllerConfig, index) =>
    gameState.uiOneHandleMasterControllerConfigs[index] = uiOneHandleMasterControllerConfig
  );

  [
    //createTestTwoAxlesCar(gameState, "1", 0, "0"),
    //createTestTwoAxlesCarWithBogies(gameState, "1"),
    //createTestTwoBogiesCar(gameState, "1", 0),
    //createTestTwoBogiesTwoCars(gameState, "1"),
    //createJNR103Series(gameState, "1", 0, "0"),
    //createTestTwoCarsWithJacobsBogies(gameState, "1"),
    //createTestMalletLocomotive(gameState, "1"),
    //createTestShikiSeries700(gameState, "1"),
  ].forEach((train, index) =>
    gameState.trains[index] = train
  );
}
