const navToggle = document.querySelector('.nav__toggle');
const primaryMenu = document.querySelector('#primary-menu');
const currentYear = document.querySelector('#current-year');

if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear());
}

if (navToggle && primaryMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    primaryMenu.classList.toggle('is-open', !isOpen);
  });

  primaryMenu.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navToggle.setAttribute('aria-expanded', 'false');
      primaryMenu.classList.remove('is-open');
    }
  });
}
