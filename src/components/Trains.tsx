import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { Axle, Bogie, BogieFormat, CarBody, Train, TrainFormat, getBodyFromBodyIndex, placeTrain } from '@/lib/trains'
import { guiState } from '@/lib/client/gui'
import { trainsState, trainsTabPanelState, triggerPreviewUpdate } from '@/lib/client/trains'
import { Line } from '@react-three/drei'
import { setCameraTargetPosition } from '@/lib/client/camera'
import { store } from '@/lib/game'
import { formState } from './gui/TrainFormatEditPanel'
import { tracksState } from '@/lib/client/tracks/store'

function BogieModel({
  trainId,
  bogieIndex,
  bogie,
  format,
  isHovered,
  isActive,
  isEditing = false,
  isPreview = false,
  ...props
}: {
  trainId: string;
  bogieIndex: number;
  bogie: Bogie;
  format?: BogieFormat;
  isHovered: boolean;
  isActive: boolean;
  isEditing?: boolean;
  isPreview?: boolean;
}) {
  const groupRef = React.useRef<THREE.Group>(null)
  const panelState = useSnapshot(trainsTabPanelState)

  useFrame(() => {
    const mutableBogie = trainId && store.data.trains[trainId]?.bogies[bogieIndex];
    if (mutableBogie) {
      groupRef.current!.position.copy(mutableBogie.position)
      groupRef.current!.rotation.copy(mutableBogie.rotation)
    } else {
      groupRef.current!.position.copy(bogie.position)
      groupRef.current!.rotation.copy(bogie.rotation)
    }
  })

  // 編集中のジョイントに設定されている場合の色判定
  let highlightColor: string | null = null;
  if (isEditing && panelState.editingTrainFormat) {
    const format = panelState.editingTrainFormat;
    
    // 1. Body Supporter Joint の Bogie 接続
    if (panelState.selectedBodySupporterJointIndex !== -1) {
      const joint = format.bodySupporterJoints[panelState.selectedBodySupporterJointIndex];
      if (joint && joint.bogieIndex === bogieIndex) {
        highlightColor = "magenta";
      }
    }
    
    // 2. Other Joint の接続 (A or B)
    if (panelState.selectedOtherJointIndex !== -1) {
      const joint = format.otherJoints[panelState.selectedOtherJointIndex];
      if (joint) {
        if (joint.bodyIndexA === bogieIndex) {
          highlightColor = "orange";
        } else if (joint.bodyIndexB === bogieIndex) {
          highlightColor = "purple";
        }
      }
    }

    // 3. アドバンスモードで編集対象として選択されているボギーに色を付ける
    if (formState.editingTrainFormatMode === "advanced" && panelState.selectedCarBodyIndex === bogieIndex) {
      highlightColor = "#10b981"; // プレミアム・エメラルドグリーン
    }
    // 4. アドバンスモードで編集対象のボギーの輪軸も選択されている場合は親ボギーを別色でハイライト
    if (formState.editingTrainFormatMode === "advanced" && panelState.selectedCarBodyIndex === bogieIndex && panelState.selectedAxleIndex !== -1) {
      highlightColor = "#059669"; // 輪軸選択中はやや暗いグリーン
    }
  }

  return (
    <>
      <group ref={groupRef} {...props}>
        <mesh
          raycast={isPreview ? () => null : undefined}
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation();
            if (trainsState.activeTrainId) return;

            if (isEditing) {
              const panelState = trainsTabPanelState;

              // スタンダードモードでは選択不可
              if (formState.editingTrainFormatMode === "standard") return;

              // ジョイント選択中かどうかの判定
              const isSelectingJoint = panelState.isSelectingCarBodyA || panelState.isSelectingCarBodyB;

              if (!isSelectingJoint) {
                // 3Dシーン上でクリックして編集対象（台車）を切り替える
                panelState.selectedCarBodyIndex = bogieIndex;
                panelState.selectedAxleIndex = -1;
                triggerPreviewUpdate();
                return;
              }

              // 1. Body Supporter Joint の Bogie 選択
              if (panelState.selectedBodySupporterJointIndex !== -1) {
                if (panelState.isSelectingCarBodyB && panelState.isSelectingCarBodyToBodySupporterJoint) {
                  panelState.editingTrainFormat!.bodySupporterJoints[panelState.selectedBodySupporterJointIndex].bogieIndex = bogieIndex;
                  panelState.isSelectingCarBodyB = false;
                  panelState.isSelectingCarBodyToBodySupporterJoint = false;
                  triggerPreviewUpdate();
                }
              }

              // 2. Other Joint の選択 (bodyA / bodyB)
              if (panelState.selectedOtherJointIndex !== -1) {
                if (panelState.isSelectingCarBodyA && !panelState.isSelectingCarBodyToBodySupporterJoint) {
                  panelState.editingTrainFormat!.otherJoints[panelState.selectedOtherJointIndex].bodyIndexA = bogieIndex;
                  panelState.isSelectingCarBodyA = false;
                  triggerPreviewUpdate();
                } else if (panelState.isSelectingCarBodyB && !panelState.isSelectingCarBodyToBodySupporterJoint) {
                  panelState.editingTrainFormat!.otherJoints[panelState.selectedOtherJointIndex].bodyIndexB = bogieIndex;
                  panelState.isSelectingCarBodyB = false;
                  triggerPreviewUpdate();
                }
              }
            }
          }}
          onPointerMove={(event) => {
            event.stopPropagation();
            if (trainsState.activeTrainId) return;

            if (isEditing) {
              const panelState = trainsTabPanelState;
              if (formState.editingTrainFormatMode === "standard") return;
              const isSelectable = 
                (!panelState.isSelectingCarBodyA && !panelState.isSelectingCarBodyB) ||
                panelState.isSelectingCarBodyB ||
                (panelState.isSelectingCarBodyA && !panelState.isSelectingCarBodyToBodySupporterJoint);

              if (isSelectable) {
                trainsState.hoveredBodyIndex = bogieIndex;
                trainsState.hoveredTrainId = trainId;
              }
            } else {
              if (guiState.selectedTab === "trains" && !trainsTabPanelState.isShowTrainTable) {
                trainsState.hoveredBodyIndex = bogieIndex;
                trainsState.hoveredTrainId = trainId;
              }
            }
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            if (trainsState.hoveredTrainId !== trainId || trainsState.hoveredBodyIndex !== bogieIndex) return;

            trainsState.hoveredBodyIndex = -1;
            trainsState.hoveredTrainId = "";
          }}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.5, 0, 3, 8]} />
          {isPreview
            ? <meshBasicMaterial color="#10b981" transparent opacity={0.6} depthWrite={false} />
            : isHovered
              ? <meshBasicMaterial color="yellow" />
              : highlightColor
                ? <meshBasicMaterial color={highlightColor} />
                : isActive && !trainsState.activeTrainId
                  ? <meshBasicMaterial color="red" />
                  : <meshStandardMaterial />
          }
        </mesh>
      </group>
      {format?.axles && bogie.axles.map((axle, axleIndex) => {
        const axleFormat = format.axles[axleIndex];
        if (!axleFormat) return null;
        return (
          <WheelAndAxleModel
            key={axleIndex}
            trainId={trainId}
            bogieIndex={bogieIndex}
            axleIndex={axleIndex}
            axle={axle}
            format={axleFormat}
            isEditing={isEditing}
            isPreview={isPreview}
          />
        );
      })}
    </>
  )
}

function WheelAndAxleModel({
  trainId,
  bogieIndex,
  axleIndex,
  axle,
  format,
  isEditing = false,
  isPreview = false,
  ...props
}: {
  trainId?: string;
  bogieIndex?: number;
  axleIndex?: number;
  axle: Axle;
  format: BogieFormat["axles"][0];
  isEditing?: boolean;
  isPreview?: boolean;
}) {
  const groupRef = React.useRef<THREE.Group>(null)
  const meshRef = React.useRef<THREE.Mesh>(null)
  const panelState = useSnapshot(trainsTabPanelState)

  useFrame(() => {
    const mutableAxle = trainId && bogieIndex !== undefined && axleIndex !== undefined && store.data.trains[trainId]?.bogies[bogieIndex]?.axles[axleIndex];
    if (mutableAxle) {
      groupRef.current!.position.copy(mutableAxle.position)
      groupRef.current!.rotation.copy(mutableAxle.rotation)
      if (meshRef.current) {
        meshRef.current.rotation.set(mutableAxle.rotationX, 0, Math.PI / 2)
      }
    } else {
      groupRef.current!.position.copy(axle.position)
      groupRef.current!.rotation.copy(axle.rotation)
      if (meshRef.current) {
        meshRef.current.rotation.set(axle.rotationX, 0, Math.PI / 2)
      }
    }
  })

  // 選択・ホバー状態
  const isParentBogieEditing = isEditing
    && formState.editingTrainFormatMode === "advanced"
    && panelState.selectedCarBodyIndex === bogieIndex
    && panelState.selectedAxleIndex === -1;
  const isSelected = isEditing
    && formState.editingTrainFormatMode === "advanced"
    && panelState.selectedCarBodyIndex === bogieIndex
    && panelState.selectedAxleIndex === axleIndex;
  const isHovered = isEditing
    && trainsState.hoveredTrainId === trainId
    && trainsState.hoveredBodyIndex === bogieIndex
    && trainsState.hoveredAxleIndex === axleIndex;

  const axleMeshColor = isHovered
    ? "yellow"
    : isSelected
      ? "#f59e0b" // アンバー（輪軸選択中）
      : isParentBogieEditing
        ? "#6ee7b7" // 薄いエメラルド（親ボギー編集中）
        : null;

  return (
    <group ref={groupRef} {...props}>
      <mesh
        ref={meshRef}
        raycast={isPreview ? () => null : undefined}
        castShadow
        receiveShadow
        position={[0, format.diameter / 2, 0]}
        rotation={[axle.rotationX, 0, Math.PI / 2]}
        onClick={isEditing ? (event) => {
          event.stopPropagation();
          const ps = trainsTabPanelState;
          if (formState.editingTrainFormatMode !== "advanced") return;
          if (ps.isSelectingCarBodyA || ps.isSelectingCarBodyB) return;
          ps.selectedCarBodyIndex = bogieIndex ?? -1;
          ps.selectedAxleIndex = axleIndex ?? -1;
          triggerPreviewUpdate();
        } : undefined}
        onPointerMove={isEditing ? (event) => {
          event.stopPropagation();
          const ps = trainsTabPanelState;
          if (formState.editingTrainFormatMode !== "advanced") return;
          if (ps.isSelectingCarBodyA || ps.isSelectingCarBodyB) return;
          trainsState.hoveredBodyIndex = bogieIndex ?? -1;
          trainsState.hoveredAxleIndex = axleIndex ?? -1;
          trainsState.hoveredTrainId = trainId ?? "";
        } : undefined}
        onPointerOut={isEditing ? (event) => {
          event.stopPropagation();
          trainsState.hoveredBodyIndex = -1;
          trainsState.hoveredAxleIndex = -1;
          trainsState.hoveredTrainId = "";
        } : undefined}
      >
        <cylinderGeometry args={[format.diameter / 2, format.diameter / 2, 1.267, 8]} />
        {isPreview
          ? <meshBasicMaterial color="#059669" transparent opacity={0.6} depthWrite={false} />
          : axleMeshColor
            ? <meshBasicMaterial color={axleMeshColor} />
            : <meshStandardMaterial />
        }
      </mesh>
    </group>
  )
}

function OtherBodyModel({
  trainId,
  bodyIndex,
  otherBodyIndex,
  otherBody,
  isHovered,
  isActive,
  isEditing = false,
  isPreview = false,
  ...props
}: {
  trainId: string;
  bodyIndex: number;
  otherBodyIndex: number;
  otherBody: CarBody;
  isHovered: boolean;
  isActive: boolean;
  isEditing?: boolean;
  isPreview?: boolean;
}) {
  const meshRef = React.useRef<THREE.Mesh>(null)
  const panelState = useSnapshot(trainsTabPanelState)

  useFrame(() => {
    const mutableOtherBody = trainId && store.data.trains[trainId]?.otherBodies[otherBodyIndex];
    if (mutableOtherBody) {
      meshRef.current!.position.copy(mutableOtherBody.position)
      meshRef.current!.rotation.copy(mutableOtherBody.rotation)
    } else {
      meshRef.current!.position.copy(otherBody.position)
      meshRef.current!.rotation.copy(otherBody.rotation)
    }
  })

  // 編集中のジョイントに設定されている場合の色判定
  let highlightColor: string | null = null;
  if (isEditing && panelState.editingTrainFormat) {
    const format = panelState.editingTrainFormat;
    
    // 1. Body Supporter Joint の OtherBody 接続
    if (panelState.selectedBodySupporterJointIndex !== -1) {
      const joint = format.bodySupporterJoints[panelState.selectedBodySupporterJointIndex];
      if (joint && joint.otherBodyIndex === otherBodyIndex) {
        highlightColor = "cyan";
      }
    }
    
    // 2. Other Joint の接続 (A or B)
    if (panelState.selectedOtherJointIndex !== -1) {
      const joint = format.otherJoints[panelState.selectedOtherJointIndex];
      if (joint) {
        if (joint.bodyIndexA === bodyIndex) {
          highlightColor = "orange";
        } else if (joint.bodyIndexB === bodyIndex) {
          highlightColor = "purple";
        }
      }
    }

    // 3. アドバンスモードで編集対象として選択されているOtherBodyに色を付ける
    if (formState.editingTrainFormatMode === "advanced" && panelState.selectedCarBodyIndex === bodyIndex) {
      highlightColor = "#10b981"; // プレミアム・エメラルドグリーン
    }
  }

  return (
    <mesh
      raycast={isPreview ? () => null : undefined}
      ref={meshRef}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        if (trainsState.activeTrainId) return;

        if (isEditing) {
          const panelState = trainsTabPanelState;

          // スタンダードモードでは選択不可
          if (formState.editingTrainFormatMode === "standard") return;

          // ジョイント選択中かどうかの判定
          const isSelectingJoint = panelState.isSelectingCarBodyA || panelState.isSelectingCarBodyB;

          if (!isSelectingJoint) {
            // 3Dシーン上でクリックして編集対象（OtherBody）を切り替える
            panelState.selectedCarBodyIndex = bodyIndex;
            panelState.selectedAxleIndex = -1;
            triggerPreviewUpdate();
            return;
          }

          // 1. Body Supporter Joint の OtherBody 選択
          if (panelState.selectedBodySupporterJointIndex !== -1) {
            if (panelState.isSelectingCarBodyA && panelState.isSelectingCarBodyToBodySupporterJoint) {
              panelState.editingTrainFormat!.bodySupporterJoints[panelState.selectedBodySupporterJointIndex].otherBodyIndex = otherBodyIndex;
              panelState.isSelectingCarBodyA = false;
              panelState.isSelectingCarBodyToBodySupporterJoint = false;
              triggerPreviewUpdate();
            }
          }

          // 2. Other Joint の選択 (bodyA / bodyB)
          if (panelState.selectedOtherJointIndex !== -1) {
            if (panelState.isSelectingCarBodyA && !panelState.isSelectingCarBodyToBodySupporterJoint) {
              panelState.editingTrainFormat!.otherJoints[panelState.selectedOtherJointIndex].bodyIndexA = bodyIndex;
              panelState.isSelectingCarBodyA = false;
              triggerPreviewUpdate();
            } else if (panelState.isSelectingCarBodyB && !panelState.isSelectingCarBodyToBodySupporterJoint) {
              panelState.editingTrainFormat!.otherJoints[panelState.selectedOtherJointIndex].bodyIndexB = bodyIndex;
              panelState.isSelectingCarBodyB = false;
              triggerPreviewUpdate();
            }
          }
        } else {
          if (guiState.selectedTab === "trains" && !trainsTabPanelState.isShowTrainTable) {
            trainsState.hoveredBodyIndex = -1;
            trainsState.hoveredTrainId = "";

            if (isActive) {
              trainsState.activeBodyIndex = -1;
              trainsState.activeTrainId = "";
            } else {
              trainsState.activeBodyIndex = bodyIndex;
              trainsState.activeTrainId = trainId;
            }
          }
        }
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (trainsState.activeTrainId) return;

        if (isEditing) {
          const panelState = trainsTabPanelState;
          if (formState.editingTrainFormatMode === "standard") return;
          const isSelectable = 
            (!panelState.isSelectingCarBodyA && !panelState.isSelectingCarBodyB) ||
            panelState.isSelectingCarBodyA ||
            (panelState.isSelectingCarBodyB && !panelState.isSelectingCarBodyToBodySupporterJoint);

          if (isSelectable) {
            trainsState.hoveredBodyIndex = bodyIndex;
            trainsState.hoveredTrainId = trainId;
          }
        } else {
          if (guiState.selectedTab === "trains" && !trainsTabPanelState.isShowTrainTable) {
            trainsState.hoveredBodyIndex = bodyIndex;
            trainsState.hoveredTrainId = trainId;
          }
        }
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        if (trainsState.hoveredTrainId !== trainId || trainsState.hoveredBodyIndex !== bodyIndex) return;

        trainsState.hoveredBodyIndex = -1;
        trainsState.hoveredTrainId = "";
      }}
    >
      <boxGeometry args={[1, 0.3, 3]} />
      {isPreview
        ? <meshBasicMaterial color="#34d399" transparent opacity={0.5} depthWrite={false} />
        : isHovered
          ? <meshBasicMaterial color="yellow" />
          : highlightColor
            ? <meshBasicMaterial color={highlightColor} />
            : isActive && !trainsState.activeTrainId
              ? <meshBasicMaterial color="red" />
              : <meshStandardMaterial />
      }
    </mesh>
  )
}

export function onFrame() {
  // Track the camera to the selected car body
  if (trainsState.activeBodyIndex !== -1 && trainsState.activeTrainId) {
    const selectedTrain = store.data.trains[trainsState.activeTrainId]
    if (!selectedTrain) return;

    const bogiesLength = selectedTrain.bogies?.length ?? 0;
    const selectedBody = trainsState.activeBodyIndex < bogiesLength
      ? selectedTrain.bogies?.[trainsState.activeBodyIndex]
      : selectedTrain.otherBodies?.[trainsState.activeBodyIndex - bogiesLength];

    if (selectedBody && selectedBody.position) {
      setCameraTargetPosition(selectedBody.position)
    }
  }
}

export default function Trains() {
  const { trains, trainFormats } = useSnapshot(store.data);
  const panelState = useSnapshot(trainsTabPanelState);
  const tracksStateSnap = useSnapshot(tracksState);
  useSnapshot(trainsState);

  // Calculate and display a temporary preview train when placing a new train
  let previewTrainComponent = null;
  if (panelState.isAddingTrain && panelState.trainFormatId) {
    const rawPoint = trainsTabPanelState.pointOnTrack ?? tracksState.pointingOnTrack;
    const format = store.data.trainFormats[panelState.trainFormatId];
    if (rawPoint && format) {
      try {
        const { train } = placeTrain(
          format,
          { trackId: rawPoint.trackId, length: rawPoint.length },
          panelState.directionIsReversed
        );
        if (train) {
          previewTrainComponent = (
            <TrainComponent
              trainId="preview"
              train={train}
              format={format}
              isPreview={true}
            />
          );
        }
      } catch (e) {
        console.error("Error creating preview train:", e);
      }
    }
  }

  return <>
    {Object.keys(trains).map(trainId => {
      const train = trains[trainId];

      return <TrainComponent key={trainId} trainId={trainId} train={train as Train} format={trainFormats[train.trainFormatId] as TrainFormat} />;
    })}
    {previewTrainComponent}
  </>;
}

export function TrainComponent({ trainId = "", train, format, isEditing = false, isPreview = false }: { trainId?: string, train: Train, format: TrainFormat, isEditing?: boolean, isPreview?: boolean }) {
  const { activeTrainId, activeBodyIndex, hoveredTrainId, hoveredBodyIndex, hoveredAxleIndex } = useSnapshot(trainsState);

  return <>
    {train.bogies.map((bogie, bogieIndex) => {
      const isActive = activeTrainId === trainId && activeBodyIndex === bogieIndex
      // 輪軸がホバーされているときは親ボギーをハイライトしない
      const isHovered = hoveredTrainId === trainId && hoveredBodyIndex === bogieIndex && hoveredAxleIndex === -1

      return (
        <BogieModel
          key={bogieIndex}
          trainId={trainId}
          bogieIndex={bogieIndex}
          bogie={bogie}
          format={format?.bogies?.[bogieIndex]}
          isActive={isActive}
          isHovered={isHovered}
          isEditing={isEditing}
          isPreview={isPreview}
        />
      )
    })}
    {train.otherBodies.map((otherBody, otherBodieIndex) => {
      const bodyIndex = otherBodieIndex + train.bogies.length
      const isActive = activeTrainId === trainId && activeBodyIndex === bodyIndex
      const isHovered = hoveredTrainId === trainId && hoveredBodyIndex === bodyIndex

      return (
        <OtherBodyModel
          key={otherBodieIndex}
          trainId={trainId}
          bodyIndex={bodyIndex}
          otherBodyIndex={otherBodieIndex}
          otherBody={otherBody}
          isActive={isActive}
          isHovered={isHovered}
          isEditing={isEditing}
          isPreview={isPreview}
        />
      )
    })}
    {isEditing && !isPreview && (
      <>
        <EditingJoints train={train} format={format} />
        <arrowHelper
          args={[
            new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(0, -2, 0),
            10,
            0x10b981,
            10,
            3
          ]}
        />
      </>
    )}
  </>;
}

function toVector3(v: any): THREE.Vector3 {
  if (!v) return new THREE.Vector3();
  if (Array.isArray(v)) {
    return new THREE.Vector3(v[0], v[1], v[2]);
  }
  return new THREE.Vector3(v.x ?? 0, v.y ?? 0, v.z ?? 0);
}

function EditingJoints({ train, format }: { train: Train, format: TrainFormat }) {
  const { selectedBodySupporterJointIndex, selectedOtherJointIndex, editingTrainFormat } = useSnapshot(trainsTabPanelState);
  const currentFormat = (editingTrainFormat as TrainFormat) || format;

  const supporterJointElements = currentFormat.bodySupporterJoints.map((joint, index) => {
    if (joint.otherBodyIndex === -1 || joint.bogieIndex === -1) return null;

    const otherBody = train.otherBodies[joint.otherBodyIndex];
    const bogie = train.bogies[joint.bogieIndex];

    if (!bogie) return null;

    const baseBody = otherBody || bogie;

    const posA = baseBody.position.clone().add(
      toVector3(joint.otherBodyPosition).applyEuler(baseBody.rotation)
    );

    const posB = bogie.position.clone().add(
      toVector3(joint.bogiePosition).applyEuler(bogie.rotation)
    );

    const isSelected = selectedBodySupporterJointIndex === index;
    const colorA = isSelected ? "yellow" : "cyan";
    const colorB = isSelected ? "yellow" : "magenta";
    const lineColor = isSelected ? "yellow" : "white";

    // Offset lines colors and width
    const offsetColorA = isSelected ? "cyan" : "rgba(0, 255, 255, 0.25)";
    const offsetColorB = isSelected ? "magenta" : "rgba(255, 0, 255, 0.25)";
    const offsetWidth = isSelected ? 2 : 0.8;

    return (
      <group key={`supporter-${index}`}>
        <mesh position={posA} renderOrder={100}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={colorA} depthTest={false} />
        </mesh>
        <mesh position={posB} renderOrder={100}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={colorB} depthTest={false} />
        </mesh>
        <Line points={[posA, posB]} color={lineColor} lineWidth={isSelected ? 3 : 1.5} depthTest={false} renderOrder={100} />

        {/* Origin connection and helper for otherbody (posA) */}
        {otherBody && (
          <>
            <Line
              points={[otherBody.position, posA]}
              color={offsetColorA}
              lineWidth={offsetWidth}
              dashed={!isSelected}
              dashSize={0.1}
              gapSize={0.05}
              depthTest={false}
              renderOrder={99}
            />
            {isSelected && (
              <mesh position={otherBody.position} renderOrder={99}>
                <boxGeometry args={[0.15, 0.15, 0.15]} />
                <meshBasicMaterial color="cyan" wireframe depthTest={false} />
              </mesh>
            )}
          </>
        )}

        {/* Origin connection and helper for bogie (posB) */}
        {bogie && (
          <>
            <Line
              points={[bogie.position, posB]}
              color={offsetColorB}
              lineWidth={offsetWidth}
              dashed={!isSelected}
              dashSize={0.1}
              gapSize={0.05}
              depthTest={false}
              renderOrder={99}
            />
            {isSelected && (
              <mesh position={bogie.position} renderOrder={99}>
                <boxGeometry args={[0.15, 0.15, 0.15]} />
                <meshBasicMaterial color="magenta" wireframe depthTest={false} />
              </mesh>
            )}
          </>
        )}
      </group>
    );
  });

  const otherJointElements = currentFormat.otherJoints.map((joint, index) => {
    if (joint.bodyIndexA === -1 || joint.bodyIndexB === -1) return null;

    const bodyA = getBodyFromBodyIndex(train, joint.bodyIndexA);
    const bodyB = getBodyFromBodyIndex(train, joint.bodyIndexB);

    if (!bodyA || !bodyB) return null;

    const posA = bodyA.position.clone().add(
      toVector3(joint.positionA).applyEuler(bodyA.rotation)
    );

    const posB = bodyB.position.clone().add(
      toVector3(joint.positionB).applyEuler(bodyB.rotation)
    );

    const isSelected = selectedOtherJointIndex === index;
    const colorA = isSelected ? "yellow" : "orange";
    const colorB = isSelected ? "yellow" : "purple";
    const lineColor = isSelected ? "yellow" : "lightgray";

    // Offset lines colors and width
    const offsetColorA = isSelected ? "orange" : "rgba(255, 165, 0, 0.25)";
    const offsetColorB = isSelected ? "purple" : "rgba(128, 0, 128, 0.25)";
    const offsetWidth = isSelected ? 2 : 0.8;

    return (
      <group key={`other-${index}`}>
        <mesh position={posA} renderOrder={100}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={colorA} depthTest={false} />
        </mesh>
        <mesh position={posB} renderOrder={100}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={colorB} depthTest={false} />
        </mesh>
        <Line points={[posA, posB]} color={lineColor} lineWidth={isSelected ? 3 : 1.5} depthTest={false} renderOrder={100} />

        {/* Origin connection and helper for Body A (posA) */}
        {bodyA && (
          <>
            <Line
              points={[bodyA.position, posA]}
              color={offsetColorA}
              lineWidth={offsetWidth}
              dashed={!isSelected}
              dashSize={0.1}
              gapSize={0.05}
              depthTest={false}
              renderOrder={99}
            />
            {isSelected && (
              <mesh position={bodyA.position} renderOrder={99}>
                <boxGeometry args={[0.15, 0.15, 0.15]} />
                <meshBasicMaterial color="orange" wireframe depthTest={false} />
              </mesh>
            )}
          </>
        )}

        {/* Origin connection and helper for Body B (posB) */}
        {bodyB && (
          <>
            <Line
              points={[bodyB.position, posB]}
              color={offsetColorB}
              lineWidth={offsetWidth}
              dashed={!isSelected}
              dashSize={0.1}
              gapSize={0.05}
              depthTest={false}
              renderOrder={99}
            />
            {isSelected && (
              <mesh position={bodyB.position} renderOrder={99}>
                <boxGeometry args={[0.15, 0.15, 0.15]} />
                <meshBasicMaterial color="purple" wireframe depthTest={false} />
              </mesh>
            )}
          </>
        )}
      </group>
    );
  });

  return (
    <>
      {supporterJointElements}
      {otherJointElements}
    </>
  );
}
