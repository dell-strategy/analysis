/* Landing page enhancement: filter the state list, Enter jumps to first match.
   Everything works without this script (links and the SVG map are native). */
(function () {
  'use strict';
  var search = document.getElementById('stateSearch');
  var list = document.getElementById('stateList');
  if (!search || !list) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('li'));

  function apply() {
    var q = search.value.trim().toLowerCase();
    items.forEach(function (li) {
      var name = li.getAttribute('data-name') || '';
      li.style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
    });
  }

  search.addEventListener('input', apply);
  search.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var firstLive = items.find(function (li) {
      return li.style.display !== 'none' && !li.classList.contains('is-soon');
    });
    var link = firstLive && firstLive.querySelector('a[href]');
    if (link) window.location.href = link.getAttribute('href');
  });
})();
