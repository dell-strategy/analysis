/* Landing page enhancement: the "find a state" combobox.
   Custom dropdown so it always opens directly below the input, full width.
   The SVG map itself is native <a> links, so navigation works without this. */
(function () {
  'use strict';
  var input = document.getElementById('statePicker');
  var menu = document.getElementById('stateMenu');
  var go = document.getElementById('statePickerGo');
  if (!input || !menu) return;

  var options = Array.prototype.slice.call(menu.querySelectorAll('.picker-option'));
  var active = -1;

  function visible() { return options.filter(function (o) { return !o.hidden; }); }
  function open() { menu.hidden = false; input.setAttribute('aria-expanded', 'true'); }
  function close() { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); setActive(-1); }

  function filter() {
    var q = input.value.trim().toLowerCase();
    options.forEach(function (o) {
      o.hidden = !!q && o.getAttribute('data-name').indexOf(q) === -1;
    });
    setActive(-1);
  }

  function setActive(i) {
    var vis = visible();
    active = i;
    options.forEach(function (o) { o.classList.remove('is-active'); });
    if (i >= 0 && i < vis.length) {
      vis[i].classList.add('is-active');
      vis[i].scrollIntoView({ block: 'nearest' });
    }
  }

  function navTo(opt) { if (opt) window.location.href = opt.getAttribute('data-href'); }

  function choose() {
    var vis = visible();
    if (active >= 0 && active < vis.length) { navTo(vis[active]); return; }
    var q = input.value.trim().toLowerCase();
    var exact = options.find(function (o) { return o.getAttribute('data-name') === q; });
    navTo(exact || vis[0]);
  }

  input.addEventListener('focus', function () { filter(); open(); });
  input.addEventListener('input', function () { filter(); open(); });
  input.addEventListener('keydown', function (e) {
    var vis = visible();
    if (e.key === 'ArrowDown') { e.preventDefault(); open(); setActive(active + 1 >= vis.length ? vis.length - 1 : active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active <= 0 ? 0 : active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(); }
    else if (e.key === 'Escape') { close(); }
  });

  options.forEach(function (o) {
    // mousedown beats the input's blur so the click still registers
    o.addEventListener('mousedown', function (e) { e.preventDefault(); navTo(o); });
  });

  document.addEventListener('click', function (e) {
    if (!input.contains(e.target) && !menu.contains(e.target)) close();
  });

  if (go) go.addEventListener('click', choose);
})();
