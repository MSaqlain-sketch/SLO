import FeatureRoute from "../../components/feature-route";
import SiteNavbar from "../../components/site-navbar";
import styles from "./page.module.css";

export default function Page() {
  return (
    <div className={`babul-home ${styles.page}`}>
      <div className={styles.navbar}>
        <SiteNavbar />
      </div>
      <div className={styles.workspace}>
        <FeatureRoute feature="chapters" />
      </div>
    </div>
  );
}
