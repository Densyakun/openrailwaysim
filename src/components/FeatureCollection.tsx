import { LineString } from 'geojson'
import CoordinatesLine from './CoordinatesLine'
import { gameState } from '@/lib/client'
import PointGeometry from './PointGeometry'

export default function FeatureCollectionComponent({
  featureCollectionId,
}: {
  featureCollectionId: string,
}) {
  return (
    <>
      {gameState.data.featureCollections[featureCollectionId].value.features.map((feature, index) => {
        switch (feature.geometry.type) {
          case "LineString":
            return <CoordinatesLine key={index} coordinates={(feature.geometry as LineString).coordinates} featureCollectionId={featureCollectionId} featureIndex={index} />;
          case "Point":
            return <PointGeometry key={index} feature={feature} />;
          default:
            return undefined;
        }
      })}
    </>
  );
}
