import '@shoelace-style/shoelace/dist/themes/light.css';
import './components/threads-app';

function init(): void {
  if (document.querySelector('threads-app')) return;
  const app = document.createElement('threads-app');
  document.body.appendChild(app);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
