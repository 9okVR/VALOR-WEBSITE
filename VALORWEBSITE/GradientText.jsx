const { useEffect } = React;

const CSS = `
@keyframes valor-grad-shift{0%{background-position:0% 50%}100%{background-position:100% 50%}}
.valor-grad{display:inline-block;background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;background-repeat:repeat}
`;

function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('valor-grad-css')) return;
  const tag = document.createElement('style');
  tag.id = 'valor-grad-css';
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

function GradientText({
  children,
  colors = ['#C8102E', '#FF8497', '#FFE6EA', '#FF8497', '#C8102E'],
  animationSpeed = 6,
  direction = 'horizontal',
  glow = false,
  style
}) {
  useEffect(injectCss, []);
  const angle = direction === 'vertical' ? 'to bottom' : direction === 'diagonal' ? 'to bottom right' : 'to right';
  const list = colors.concat([colors[0]]).join(', ');
  const base = {
    backgroundImage: 'linear-gradient(' + angle + ', ' + list + ')',
    backgroundSize: direction === 'vertical' ? '100% 300%' : '300% 100%',
    animation: 'valor-grad-shift ' + animationSpeed + 's linear infinite alternate'
  };
  if (glow) base.filter = 'drop-shadow(0 0 10px rgba(200,16,46,0.45))';
  return React.createElement('span', {
    className: 'valor-grad',
    style: Object.assign(base, style || {})
  }, children);
}

module.exports = { GradientText };
