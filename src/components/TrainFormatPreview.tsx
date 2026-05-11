import * as React from 'react'
import * as THREE from 'three'
import { TrainFormat, Train, Bogie, CarBody, calcJointsToRotateBody, syncOtherBodies, placeTrain, bogieToAxles, getAxlePosition, getAxleRotation } from '@/lib/trains'
import { TrainComponent } from './Trains'
import { Line, Grid, Html } from '@react-three/drei'
import { useSnapshot } from 'valtio'
import { formState } from './gui/TrainFormatEditPanel'
import { trainsTabPanelState } from '@/lib/client/trains'
import { useThree } from '@react-three/fiber'
import { store } from '@/lib/game'

export default function TrainFormatPreview({ format }: { format: TrainFormat }) {
  const { invalidate } = useThree();
  const { editingTrainFormatMode, standardCarFormats, standardCarFormatIndexes } = useSnapshot(formState);
  const { isSyncPreview } = useSnapshot(trainsTabPanelState);

  // 1. プレビュー用の線路とフォーマットの登録
  React.useEffect(() => {
    const previewTrack = {
      position: new THREE.Vector3(0, 0, 2500),
      rotationY: Math.PI / 2,
      length: 5000,
      radius: 0,
      idOfTrackOrSwitchConnectedFromStart: "",
      idOfTrackOrSwitchConnectedFromEnd: "",
      connectedFromStartIsTrack: true,
      connectedFromEndIsTrack: true,
      connectedFromStartIsToEnd: false,
      connectedFromEndIsToEnd: false,
      beginCant: 0,
      endCant: 0,
      trackModels: [],
      gradients: { 0: 0 },
    } as any;

    store.data.tracks["__preview_track__"] = previewTrack;
    store.data.trainFormats["__preview_format__"] = format;

    return () => {
      delete store.data.tracks["__preview_track__"];
      delete store.data.trainFormats["__preview_format__"];
      delete store.data.trains["__preview_train__"];
    };
  }, [format]);

  // 2. プレビュー用列車の配置・初期化
  React.useEffect(() => {
    // 同期がONの場合で、すでに列車が存在しているなら再初期化しない（時間経過での走行状態を維持）
    if (isSyncPreview && store.data.trains["__preview_train__"]) {
      const existing = store.data.trains["__preview_train__"];
      (existing as any).isSyncPreview = true;
      if (existing.speed === 0) existing.speed = 15;
      return;
    }

    const previewTracks = { __preview_track__: store.data.tracks["__preview_track__"] };
    if (!previewTracks.__preview_track__) return;

    const { train: placedTrain } = placeTrain(
      format,
      { trackId: "__preview_track__", length: 2500 },
      false,
      previewTracks
    );

    if (placedTrain) {
      placedTrain.trainFormatId = "__preview_format__";
      (placedTrain as any).isSyncPreview = isSyncPreview;
      if (isSyncPreview) {
        placedTrain.speed = 15;
      }
      if (placedTrain.weight <= 0) placedTrain.weight = 30000;

      placedTrain.bogies.forEach(bogie => {
        bogie.axles.forEach(axle => {
          axle.position.copy(getAxlePosition(axle, previewTracks));
          axle.rotation.copy(getAxleRotation(axle.pointOnTrack, axle.rotationIsReversed, previewTracks));
        });
        bogieToAxles(bogie, previewTracks);
      });

      calcJointsToRotateBody(placedTrain, format);
      syncOtherBodies(placedTrain, format);

      store.data.trains["__preview_train__"] = placedTrain;
    } else {
      store.data.trains["__preview_train__"] = {
        trainFormatId: "__preview_format__",
        bogies: [],
        otherBodies: [],
        cabStates: [],
        fromJointIndexes: [],
        toJointIndexes: [],
        speed: 0,
        weight: 1,
        motors: 0,
        currentDiagramId: "",
        currentDiagramCurveIndex: -1,
        currentDiagramSectionIndex: 0,
        currentRouteIndex: 0,
        isStopping: true,
      } as any;
    }
  }, [format, isSyncPreview]);

  // 3. レンダリング用列車は store.data.trains.__preview_train__ からSnapshotで取得
  const trainsSnapshot = useSnapshot(store.data.trains);
  const train = (trainsSnapshot["__preview_train__"] || {
    trainFormatId: "__preview_format__",
    bogies: [],
    otherBodies: [],
    speed: 0,
    weight: 1,
  }) as unknown as Train;

  React.useEffect(() => {
    invalidate();
  }, [train, invalidate]);

  const previewGuides = React.useMemo(() => {
    if (editingTrainFormatMode !== "standard" || !standardCarFormatIndexes || !standardCarFormats || !train) return null;

    return standardCarFormatIndexes.map((carFormatIndex, index) => {
      const carFormat = standardCarFormats[carFormatIndex];
      const otherBody = train.otherBodies[index];

      if (!carFormat || !otherBody) return null;

      const carLength = parseFloat(carFormat.carLength) || 20;
      const carNumber = index + 1;

      return (
        <group key={`preview-car-${index}`} position={[0, 2.0875, otherBody.position.z]} rotation={otherBody.rotation}>
          {/* 号車番号テキストラベル（HTMLビルボード） */}
          <Html position={[0, -4.0, 0]} center>
            <div style={{
              background: "rgba(15, 23, 42, 0.9)",
              color: "#fff",
              padding: "4px 8px",
              borderRadius: "6px",
              fontFamily: "sans-serif",
              fontSize: "12px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
              border: `1px solid rgba(255,255,255,0.2)`,
              pointerEvents: "none",
              userSelect: "none"
            }}>
              Car {carNumber}
            </div>
          </Html>

          {/* carLengthを視覚化するワイヤーフレームの車体ガイド */}
          <mesh renderOrder={90}>
            <boxGeometry args={[3.0, 4.025, carLength - 1]} />
            <meshBasicMaterial
              color="#06b6d4"
              wireframe
              transparent
              opacity={0.35}
              depthTest={false}
            />
          </mesh>
        </group>
      );
    });
  }, [editingTrainFormatMode, standardCarFormatIndexes, standardCarFormats, train]);

  return (
    <group>
      <Grid args={[10, 10]} infiniteGrid fadeDistance={30} fadeStrength={1.5} cellColor="#444" sectionColor="#666" />
      {/* Virtual Track */}
      <Line points={[[0.7175, 0, -2500], [0.7175, 0, 2500]]} color="silver" lineWidth={2} />
      <Line points={[[-0.7175, 0, -2500], [-0.7175, 0, 2500]]} color="silver" lineWidth={2} />

      <TrainComponent train={train} format={format} isEditing />
      {previewGuides}
    </group>
  )
}
