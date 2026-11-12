import {testEnvironment} from './config';
import './publicLinks.css';
export default function PublicLinks(){
 return <nav className="public-links" aria-label="HH information">
  {testEnvironment&&<a href="./home.html" target="_blank" rel="noopener">Explore HH</a>}
  <a href="./about.html" target="_blank" rel="noopener">About HH</a>
  <a href="./privacy.html" target="_blank" rel="noopener">Privacy</a>
  <a href="./terms.html" target="_blank" rel="noopener">Terms</a>
 </nav>;
}
