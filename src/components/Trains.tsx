import * as React from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSnapshot } from 'valtio'
import { Axle, Bogie, OtherBody, Train } from '@/lib/trains'
import { gameState } from '@/lib/client/client'
import { guiState } from '@/lib/client/gui'
import { trainsState, trainsTabPanelState } from '@/lib/client/trains'
import { Line } from '@react-three/drei'
import { setCameraTargetPosition } from '@/lib/client/camera'

function BogieModel({
  trainId,
  bogieIndex,
  bogie,
  isHovered,
  isActive,
  isEditing = false,
  ...props
}: {
  trainId: string;
  bogieIndex: number;
  bogie: Bogie;
  isHovered: boolean;
  isActive: boolean;
  isEditing?: boolean;
}) {
  const groupRef = React.useRef<THREE.Group>(null)

  useFrame(() => {
    groupRef.current!.position.copy(bogie.position)
    groupRef.current!.rotation.copy(bogie.rotation)
  })

  return (
    <>
      <group ref={groupRef} {...props}>
        <mesh
          castShadow
          receiveShadow
          onClick={() => {
            if (trainsState.activeTrainId) return;

            /*if (guiState.selectedTab === "trains" && !trainsTabPanelState.isShowTable) {
              trainsState.hoveredBodyIndex = -1;
              trainsState.hoveredTrainId = "";

              if (isActive) {
                trainsState.activeBodyIndex = -1;
                trainsState.activeTrainId = "";
              } else {
                trainsState.activeBodyIndex = bogieIndex;
                trainsState.activeTrainId = trainId;
              }
            }*/

            if (isEditing) {
              if (trainsTabPanelState.isSelectingCarBodyA && !trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint) {
                trainsState.hoveredBodyIndex = -1;
                trainsState.hoveredTrainId = "";

                trainsTabPanelState.otherJoints[trainsTabPanelState.selectedOtherJointIndex].bodyIndexA = bogieIndex;
              }

              if (trainsTabPanelState.isSelectingCarBodyB) {
                trainsState.hoveredBodyIndex = -1;
                trainsState.hoveredTrainId = "";

                if (trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint)
                  trainsTabPanelState.bodySupporterJoints[trainsTabPanelState.selectedBodySupporterJointIndex].bogieIndex = bogieIndex;
                else
                  trainsTabPanelState.otherJoints[trainsTabPanelState.selectedOtherJointIndex].bodyIndexB = bogieIndex;
              }
            }
          }}
          onPointerMove={() => {
            if (trainsState.activeTrainId) return;

            if (
              /*guiState.selectedTab === "trains" && !trainsTabPanelState.isShowTable
              || */isEditing && (
                trainsTabPanelState.isSelectingCarBodyA && !trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint
                || trainsTabPanelState.isSelectingCarBodyB
              )
            ) {
              trainsState.hoveredBodyIndex = bogieIndex;
              trainsState.hoveredTrainId = trainId;
            }
          }}
          onPointerOut={() => {
            if (trainsState.hoveredTrainId !== trainId || trainsState.hoveredBodyIndex !== bogieIndex) return;

            trainsState.hoveredBodyIndex = -1;
            trainsState.hoveredTrainId = "";
          }}
          rotation={[Math.PI / -2, 0, 0]}
        >
          <cylinderGeometry args={[0.5, 0, 3, 8]} />
          {isHovered
            ? <meshBasicMaterial color="yellow" />
            : isActive && !trainsState.activeTrainId
              ? <meshBasicMaterial color="red" />
              : <meshStandardMaterial />
          }
        </mesh>
      </group>
      {bogie.axles.map((axle, axleIndex) => (
        <WheelAndAxleModel
          key={axleIndex}
          axle={axle}
        />
      ))}
    </>
  )
}

function WheelAndAxleModel({ axle, ...props }: { axle: Axle }) {
  const groupRef = React.useRef<THREE.Group>(null)

  useFrame(() => {
    groupRef.current!.position.copy(axle.position)
    groupRef.current!.rotation.copy(axle.rotation)
  })

  return (
    <group ref={groupRef} {...props}>
      <mesh
        castShadow
        receiveShadow
        position={[0, axle.diameter / 2, 0]}
        rotation={[axle.rotationX, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[axle.diameter / 2, axle.diameter / 2, 1.267, 8]} />
        <meshStandardMaterial />
      </mesh>
    </group>
  )
}

function OtherBodyModel({
  trainId,
  bodyIndex,
  otherBody,
  isHovered,
  isActive,
  isEditing = false,
  ...props
}: {
  trainId: string;
  bodyIndex: number;
  otherBody: OtherBody;
  isHovered: boolean;
  isActive: boolean;
  isEditing?: boolean;
}) {
  const meshRef = React.useRef<THREE.Mesh>(null)

  useFrame(() => {
    meshRef.current!.position.copy(otherBody.position)
    meshRef.current!.rotation.copy(otherBody.rotation)
  })

  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      onClick={() => {
        if (trainsState.activeTrainId) return;

        if (guiState.selectedTab === "trains" && !trainsTabPanelState.isShowTable) {
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

        if (isEditing) {
          if (trainsTabPanelState.isSelectingCarBodyA) {
            trainsState.hoveredBodyIndex = -1;
            trainsState.hoveredTrainId = "";

            if (trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint)
              trainsTabPanelState.bodySupporterJoints[trainsTabPanelState.selectedBodySupporterJointIndex].otherBodyIndex = bodyIndex - trainsTabPanelState.axleTable.length;
            else
              trainsTabPanelState.otherJoints[trainsTabPanelState.selectedOtherJointIndex].bodyIndexA = bodyIndex;
          }

          if (trainsTabPanelState.isSelectingCarBodyB && !trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint) {
            trainsState.hoveredBodyIndex = -1;
            trainsState.hoveredTrainId = "";

            trainsTabPanelState.otherJoints[trainsTabPanelState.selectedOtherJointIndex].bodyIndexB = bodyIndex;
          }
        }
      }}
      onPointerMove={() => {
        if (trainsState.activeTrainId) return;

        if (
          guiState.selectedTab === "trains" && !trainsTabPanelState.isShowTable
          || isEditing && (
            trainsTabPanelState.isSelectingCarBodyA
            || trainsTabPanelState.isSelectingCarBodyB && !trainsTabPanelState.isSelectingCarBodyToBodySupporterJoint
          )
        ) {
          trainsState.hoveredBodyIndex = bodyIndex;
          trainsState.hoveredTrainId = trainId;
        }
      }}
      onPointerOut={() => {
        if (trainsState.hoveredTrainId !== trainId || trainsState.hoveredBodyIndex !== bodyIndex) return;

        trainsState.hoveredBodyIndex = -1;
        trainsState.hoveredTrainId = "";
      }}
      {...props}
    >
      <boxGeometry args={[1, 0.3, 3]} />
      {isHovered
        ? <meshBasicMaterial color="yellow" />
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
    const selectedTrain = gameState.data.trains[trainsState.activeTrainId]
    const selectedBody = trainsState.activeBodyIndex < selectedTrain.bogies.length ? selectedTrain.bogies[trainsState.activeBodyIndex] : selectedTrain.otherBodies[trainsState.activeBodyIndex - selectedTrain.bogies.length]
    setCameraTargetPosition(selectedBody.position)
  }
}

export default function Trains() {
  const { trains } = useSnapshot(gameState.data);
  useSnapshot(trainsState);
  const { selectedTab } = useSnapshot(guiState);
  const { editingTrain } = useSnapshot(trainsTabPanelState);

  return <>
    {Object.keys(trains).map(trainId => {
      const train = trains[trainId];

      return <TrainComponent key={trainId} trainId={trainId} train={train as Train} />;
    })}
    {selectedTab === "trains" && editingTrain && <TrainComponent train={editingTrain as Train} isEditing />}
  </>;
}

function TrainComponent({ trainId = "", train, isEditing = false }: { trainId?: string, train: Train, isEditing?: boolean }) {
  return <>
    {train.bogies.map((bogie, bogieIndex) => {
      const isActive = trainsState.activeTrainId === trainId && trainsState.activeBodyIndex === bogieIndex
      const isHovered = trainsState.hoveredTrainId === trainId && trainsState.hoveredBodyIndex === bogieIndex

      return (
        <BogieModel
          key={bogieIndex}
          trainId={trainId}
          bogieIndex={bogieIndex}
          bogie={bogie}
          isActive={isActive}
          isHovered={isHovered}
          isEditing={isEditing}
        />
      )
    })}
    {train.otherBodies.map((otherBody, otherBodieIndex) => {
      const bodyIndex = otherBodieIndex + train.bogies.length
      const isActive = trainsState.activeTrainId === trainId && trainsState.activeBodyIndex === bodyIndex
      const isHovered = trainsState.hoveredTrainId === trainId && trainsState.hoveredBodyIndex === bodyIndex

      return (
        <OtherBodyModel
          key={otherBodieIndex}
          trainId={trainId}
          bodyIndex={bodyIndex}
          otherBody={otherBody}
          isActive={isActive}
          isHovered={isHovered}
          isEditing={isEditing}
        />
      )
    })}
    {isEditing && <EditingJoints />}
  </>;
}

function EditingJoints() {
  const { editingTrain, selectedBodySupporterJointIndex, selectedOtherJointIndex, axleTable } = useSnapshot(trainsTabPanelState);

  if (!editingTrain) return null;

  return <>
    <>
      {editingTrain.bodySupporterJoints.map((bodySupporterJoint, index) => <React.Fragment key={index}>
        {bodySupporterJoint.otherBodyIndex !== -1 && bodySupporterJoint.bogieIndex !== -1 &&
          selectedBodySupporterJointIndex === index && <>
            <Line
              points={[
                editingTrain.otherBodies[bodySupporterJoint.otherBodyIndex].position,
                editingTrain.otherBodies[bodySupporterJoint.otherBodyIndex].position.clone()
                  .add(
                    bodySupporterJoint.otherBodyPosition.clone()
                      .applyEuler(editingTrain.otherBodies[bodySupporterJoint.otherBodyIndex].rotation)
                  ),
              ]}
              color={"#f00"}
              depthTest={false}
            />
            <Line
              points={[
                editingTrain.bogies[bodySupporterJoint.bogieIndex].position,
                editingTrain.bogies[bodySupporterJoint.bogieIndex].position.clone()
                  .add(
                    bodySupporterJoint.bogiePosition.clone()
                      .applyEuler(editingTrain.bogies[bodySupporterJoint.bogieIndex].rotation)
                  ),
              ]}
              color={"#0f0"}
              depthTest={false}
            />
          </>}
      </React.Fragment>)}
    </>
    <>
      {editingTrain.otherJoints.map((otherJoint, index) => <React.Fragment key={index}>
        {otherJoint.bodyIndexA !== -1 && otherJoint.bodyIndexB !== -1 &&
          selectedOtherJointIndex === index && <>
            <Line
              points={otherJoint.bodyIndexA < axleTable.length
                ? [
                  editingTrain.bogies[otherJoint.bodyIndexA].position,
                  editingTrain.bogies[otherJoint.bodyIndexA].position.clone()
                    .add(
                      otherJoint.positionA.clone()
                        .applyEuler(editingTrain.bogies[otherJoint.bodyIndexA].rotation)
                    ),
                ]
                : [
                  editingTrain.otherBodies[otherJoint.bodyIndexA - axleTable.length].position,
                  editingTrain.otherBodies[otherJoint.bodyIndexA - axleTable.length].position.clone()
                    .add(
                      otherJoint.positionA.clone()
                        .applyEuler(editingTrain.otherBodies[otherJoint.bodyIndexA - axleTable.length].rotation)
                    ),
                ]
              }
              color={"#f00"}
              depthTest={false}
            />
            <Line
              points={otherJoint.bodyIndexB < axleTable.length
                ? [
                  editingTrain.bogies[otherJoint.bodyIndexB].position,
                  editingTrain.bogies[otherJoint.bodyIndexB].position.clone()
                    .add(
                      otherJoint.positionB.clone()
                        .applyEuler(editingTrain.bogies[otherJoint.bodyIndexB].rotation)
                    ),
                ]
                : [
                  editingTrain.otherBodies[otherJoint.bodyIndexB - axleTable.length].position,
                  editingTrain.otherBodies[otherJoint.bodyIndexB - axleTable.length].position.clone()
                    .add(
                      otherJoint.positionB.clone()
                        .applyEuler(editingTrain.otherBodies[otherJoint.bodyIndexB - axleTable.length].rotation)
                    ),
                ]
              }
              color={"#0f0"}
              depthTest={false}
            />
          </>}
      </React.Fragment>)}
    </>
  </>;
}
