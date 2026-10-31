import { Suspense } from "react";
import FeaturePage, { ChatFeaturePage, type FeatureName } from "./feature-page";

export default function FeatureRoute({ feature }: { feature: FeatureName }) {
  if (feature === "chat") {
    return (
      <Suspense fallback={null}>
        <ChatFeaturePage />
      </Suspense>
    );
  }
  return <FeaturePage feature={feature} />;
}
