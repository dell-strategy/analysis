/* Report page enhancement: highlight the section-nav link for the section in view.
   Anchor links and smooth scrolling work without this script. */
(function () {
  'use strict';
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (!links.length || !('IntersectionObserver' in window)) return;

  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

  var setActive = function (id) {
    links.forEach(function (a) { a.classList.remove('active'); });
    if (byId[id]) byId[id].classList.add('active');
  };

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) setActive(en.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  Object.keys(byId).forEach(function (id) {
    var sec = document.getElementById(id);
    if (sec) obs.observe(sec);
  });
})();
