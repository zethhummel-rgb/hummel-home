import {testEnvironment} from './config';
import './publicLinks.css';

export default function PublicLinks() {
  const safariStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const installedTouchApp = window.matchMedia('(display-mode: standalone) and (pointer: coarse)').matches;
  const aboutTarget = safariStandalone || installedTouchApp ? undefined : '_blank';

  return (
    <nav className="public-links" aria-label="HH information">
      {testEnvironment && <a href="./home.html" target="_blank" rel="noopener">Explore HH</a>}
      <a href="./about.html?from=app" target={aboutTarget} rel="noopener">About HH</a>
      <a href="./privacy.html" target="_blank" rel="noopener">Privacy</a>
      <a href="./terms.html" target="_blank" rel="noopener">Terms</a>
    </nav>
  );
}
