import FeaturePage, { type FeatureName } from "./feature-page";

export default function FeatureRoute({ feature }: { feature: FeatureName }) {
  return <FeaturePage feature={feature} />;
}
