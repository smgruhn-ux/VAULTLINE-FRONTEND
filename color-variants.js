// Make quick-view color swatches interactive and keep them synced with the variant selector.
const quickSwatches = document.querySelector('#quick-swatches');
const quickVariants = document.querySelector('#quick-variants');

function colorNameFromOption(option) {
  const text = (option?.textContent || '').replace(/\s+—\s+SOLD OUT$/i, '').trim();
  return text.split(' / ')[0].trim();
}

function getColorGroups(select) {
  const groups = [];
  [...select.options].forEach((option) => {
    const name = colorNameFromOption(option);
    if (name && !groups.some((group) => group.name === name)) {
      groups.push({ name, options: [] });
    }
    const group = groups.find((item) => item.name === name);
    if (group) group.options.push(option);
  });
  return groups;
}

function syncSwatches() {
  const select = document.querySelector('#variant-select');
  if (!select || !quickSwatches) return;

  const swatches = [...quickSwatches.querySelectorAll('span')];
  const groups = getColorGroups(select);
  const selectedColor = colorNameFromOption(select.options[select.selectedIndex]);

  swatches.forEach((swatch, index) => {
    const group = groups[index];
    swatch.classList.toggle('is-selected', !!group && group.name === selectedColor);
    swatch.classList.toggle('is-unavailable', !!group && !group.options.some((option) => !option.disabled));
    swatch.setAttribute('role', 'button');
    swatch.setAttribute('tabindex', group?.options.some((option) => !option.disabled) ? '0' : '-1');
    swatch.setAttribute('aria-label', group ? `Select ${group.name}` : 'Select color');
    swatch.setAttribute('aria-pressed', String(!!group && group.name === selectedColor));
  });
}

function chooseSwatch(swatch) {
  const select = document.querySelector('#variant-select');
  if (!select || !quickSwatches) return;

  const swatches = [...quickSwatches.querySelectorAll('span')];
  const index = swatches.indexOf(swatch);
  const group = getColorGroups(select)[index];
  if (!group) return;

  const next = group.options.find((option) => !option.disabled);
  if (!next) return;

  select.value = next.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  syncSwatches();
}

document.addEventListener('click', (event) => {
  const swatch = event.target.closest('#quick-swatches span');
  if (swatch) chooseSwatch(swatch);
});

document.addEventListener('keydown', (event) => {
  const swatch = event.target.closest?.('#quick-swatches span');
  if (swatch && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    chooseSwatch(swatch);
  }
});

document.addEventListener('change', (event) => {
  if (event.target?.id === 'variant-select') syncSwatches();
});

// The quick-view contents are populated dynamically, so observe them and style/sync when opened.
const observer = new MutationObserver(() => syncSwatches());
if (quickSwatches) observer.observe(quickSwatches, { childList: true, subtree: true });
if (quickVariants) observer.observe(quickVariants, { childList: true, subtree: true });

const style = document.createElement('style');
style.textContent = `
#quick-swatches span{cursor:pointer;position:relative;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;}
#quick-swatches span:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.7)!important;}
#quick-swatches span.is-selected{border-color:#f2f1ed!important;box-shadow:0 0 0 2px #050505,0 0 0 3px #f2f1ed!important;transform:translateY(-1px);}
#quick-swatches span.is-unavailable{opacity:.28;cursor:not-allowed;}
#quick-swatches span:focus-visible{outline:2px solid #b63a50;outline-offset:3px;}
`;
document.head.appendChild(style);
