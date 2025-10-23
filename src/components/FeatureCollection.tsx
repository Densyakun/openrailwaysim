import { Feature, LineString } from 'geojson'
import CoordinatesLine from './CoordinatesLine'
import { gameState } from '@/lib/client/client'
import PointGeometry from './PointGeometry'
import { useSnapshot } from 'valtio'

export default function FeatureCollectionComponent({
  featureCollectionId,
}: {
  featureCollectionId: string,
}) {
  const { featureCollections } = useSnapshot(gameState.data);

  return (
    <>
      {featureCollections[featureCollectionId].value.features.map((feature, index) => {
        switch (feature.geometry.type) {
          case "LineString":
            return <CoordinatesLine key={index} coordinates={(feature.geometry as LineString).coordinates} featureCollectionId={featureCollectionId} featureIndex={index} />;
          case "Point":
            return <PointGeometry key={index} feature={feature as Feature} />;
          default:
            return undefined;
        }
      })}
    </>
  );
}
