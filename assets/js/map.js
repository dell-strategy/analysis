/* Landing page enhancement: the "find a state" picker.
   The SVG map itself is native <a> links, so navigation works without this. */
(function () {
  'use strict';
  var input = document.getElementById('statePicker');
  var list = document.getElementById('state-options');
  var go = document.getElementById('statePickerGo');
  if (!input || !list) return;

  function hrefFor(value) {
    var v = value.trim().toLowerCase();
    if (!v) return null;
    var opts = list.options;
    for (var i = 0; i < opts.length; i++) {
      if ((opts[i].value || '').toLowerCase() === v) return opts[i].getAttribute('data-href');
    }
    return null;
  }

  function navigate() {
    var href = hrefFor(input.value);
    if (href) { window.location.href = href; return true; }
    input.focus();
    return false;
  }

  // Picking from the native dropdown fires 'change'.
  input.addEventListener('change', navigate);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); navigate(); }
  });
  if (go) go.addEventListener('click', navigate);
})();
